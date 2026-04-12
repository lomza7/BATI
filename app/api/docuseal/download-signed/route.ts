import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { docusealFetch, buildQuoteHtml } from '@/lib/docuseal';

export const runtime = 'nodejs';

/**
 * Génère et retourne l'URL d'un PDF du devis avec la signature incrustée.
 *
 * DocuSeal ne ré-injecte pas la signature dans le PDF final pour les
 * templates créés depuis du HTML. On récupère donc l'image de signature
 * depuis l'API DocuSeal, on re-génère le HTML avec la signature en <img>,
 * et on crée un template temporaire pour obtenir le PDF.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Config serveur manquante' }, { status: 503 });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { quote_send_id } = await request.json();
    if (!quote_send_id) {
      return NextResponse.json({ error: 'quote_send_id requis' }, { status: 400 });
    }

    // Charger le quote_send
    const { data: send } = await admin
      .from('quote_sends')
      .select('id, quote_id, user_id, docuseal_submission_id, signed_at')
      .eq('id', quote_send_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!send?.docuseal_submission_id || !send.signed_at) {
      return NextResponse.json({ error: 'Devis non signé ou introuvable' }, { status: 404 });
    }

    // Récupérer la signature depuis DocuSeal
    interface DocuSealSubmission {
      submitters: {
        values: { field: string; value: string | null }[];
      }[];
    }

    const submission = await docusealFetch<DocuSealSubmission>(
      `/submissions/${send.docuseal_submission_id}`,
    );

    const values = submission?.submitters?.[0]?.values || [];
    const signatureValue = values.find((v) => v.field === 'Signature')?.value;

    if (!signatureValue) {
      return NextResponse.json({ error: 'Signature introuvable dans DocuSeal' }, { status: 404 });
    }

    // Charger le devis, les lignes, le client et le profil artisan
    const [quoteRes, linesRes, profileRes] = await Promise.all([
      admin.from('quotes').select('*, clients(*)').eq('id', send.quote_id).single(),
      admin.from('quote_lines').select('*').eq('quote_id', send.quote_id).order('position'),
      admin.from('profiles').select('company_name, full_name, siret, company_address, company_postal_code, company_city, company_phone, tva_number, logo_url, document_config').eq('id', user.id).single(),
    ]);

    if (!quoteRes.data) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    const quote = quoteRes.data;
    const lines = (linesRes.data || []).map((l: Record<string, unknown>) => ({
      description: (l.description as string) || '',
      detail: (l.detail as string) || null,
      quantity: Number(l.quantity) || 0,
      unit: (l.unit as string) || 'u',
      unit_price: Number(l.unit_price) || 0,
      tva_rate: Number(l.tva_rate ?? 20),
      total: Number(l.total) || 0,
    }));
    const client = quote.clients || { name: 'Client' };
    const artisan = (profileRes.data || { company_name: 'Artisan' }) as Record<string, unknown> & { company_name: string };

    const rawDesc = (quote.description || '') as string;
    const cleanDescription = rawDesc.replace(/^Brouillon (de devis |préparé ).*$/im, '').trim();

    // Générer le HTML avec la signature incrustée
    const html = buildQuoteHtml(
      {
        quote_number: quote.quote_number,
        title: quote.title || '',
        description: cleanDescription,
        total_ht: Number(quote.total_ht) || 0,
        total_tva: Number(quote.total_tva) || 0,
        total_ttc: Number(quote.total_ttc) || 0,
        tva_rate: Number(quote.tva_rate) || 20,
        tva_breakdown: quote.tva_breakdown,
        created_at: quote.created_at,
        valid_until: quote.valid_until,
      },
      lines,
      {
        name: client.name || 'Client',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        postal_code: client.postal_code || '',
        city: client.city || '',
      },
      artisan as { company_name: string; full_name?: string; siret?: string; company_address?: string; company_postal_code?: string; company_city?: string; company_phone?: string; tva_number?: string; logo_url?: string; document_config?: Record<string, unknown> },
      { signatureImageUrl: signatureValue, signedAt: send.signed_at },
    );

    // Créer un template DocuSeal temporaire pour obtenir le PDF
    interface DocuSealTemplate {
      id: number;
      documents: { url: string }[];
    }

    const template = await docusealFetch<DocuSealTemplate>('/templates/html', {
      method: 'POST',
      body: {
        html,
        name: `Devis signé ${quote.quote_number}`,
      },
    });

    const pdfUrl = template?.documents?.[0]?.url;
    if (!pdfUrl) {
      return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 502 });
    }

    // Mettre à jour l'URL en base pour les prochains téléchargements
    await admin
      .from('quote_sends')
      .update({ docuseal_signed_document_url: pdfUrl })
      .eq('id', send.id);

    return NextResponse.json({ url: pdfUrl });
  } catch (err) {
    console.error('[download-signed] Error:', err);
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
