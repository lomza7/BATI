import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { docusealFetch, buildQuoteHtml } from '@/lib/docuseal';
import { buildQuoteSignatureEmail } from '@/lib/email-templates';

export const runtime = 'nodejs';

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    // Verifier auth via le header Authorization (token Supabase)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Client avec le token de l'utilisateur pour verifier l'identite
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    // Client admin pour les operations privilegiees
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 503 });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { quote_id, client_name, client_email, expires_in_days } = body as {
      quote_id: string;
      client_name: string;
      client_email?: string;
      expires_in_days: number;
    };

    if (!quote_id || !client_name?.trim()) {
      return NextResponse.json({ error: 'quote_id et client_name requis' }, { status: 400 });
    }

    // Fetch quote + lines + client + artisan profile
    const [quoteRes, linesRes, profileRes] = await Promise.all([
      admin.from('quotes').select('*, clients(*)').eq('id', quote_id).single(),
      admin.from('quote_lines').select('*').eq('quote_id', quote_id).order('position'),
      admin.from('profiles').select('company_name, full_name, siret, company_address, company_postal_code, company_city, company_phone, tva_number, logo_url, document_config').eq('id', user.id).single(),
    ]);

    if (quoteRes.error || !quoteRes.data) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    const quote = quoteRes.data;
    const lines = (linesRes.data || []).map((l: Record<string, unknown>) => ({
      description: (l.description as string) || '',
      quantity: Number(l.quantity) || 0,
      unit: (l.unit as string) || 'u',
      unit_price: Number(l.unit_price) || 0,
      total: Number(l.total) || 0,
    }));
    const client = quote.clients || { name: client_name.trim() };
    const artisanRaw = profileRes.data || { company_name: 'Artisan' };
    const artisan = artisanRaw as Record<string, unknown> & { company_name: string };

    // Generer le HTML du devis
    const html = buildQuoteHtml(
      {
        quote_number: quote.quote_number,
        title: quote.title || '',
        total_ht: Number(quote.total_ht) || 0,
        total_tva: Number(quote.total_tva) || 0,
        total_ttc: Number(quote.total_ttc) || 0,
        tva_rate: Number(quote.tva_rate) || 20,
        created_at: quote.created_at,
        valid_until: quote.valid_until,
      },
      lines,
      {
        name: client.name || client_name.trim(),
        email: client.email || client_email || '',
        phone: client.phone || '',
        address: client.address || '',
        postal_code: client.postal_code || '',
        city: client.city || '',
      },
      artisan as { company_name: string; full_name?: string; siret?: string; company_address?: string; company_postal_code?: string; company_city?: string; company_phone?: string; tva_number?: string; logo_url?: string; document_config?: Record<string, unknown> },
    );

    // Etape 1 — Creer un template DocuSeal a partir du HTML du devis
    const submitterEmail = client_email?.trim() || client.email || `${quote_id}@placeholder.hellobat.app`;

    interface DocuSealTemplate {
      id: number;
      slug: string;
      name: string;
    }

    const template = await docusealFetch<DocuSealTemplate>('/templates/html', {
      method: 'POST',
      body: {
        html,
        name: `Devis ${quote.quote_number}`,
      },
    });

    if (!template?.id) {
      return NextResponse.json({ error: 'Erreur creation template DocuSeal' }, { status: 502 });
    }

    // Etape 2 — Creer une submission avec ce template
    interface DocuSealSubmitter {
      id: number;
      slug: string;
      submission_id: number;
    }

    const webhookBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';

    const docusealResponse = await docusealFetch<DocuSealSubmitter[]>('/submissions', {
      method: 'POST',
      body: {
        template_id: template.id,
        send_email: false,
        webhook_url: `${webhookBase}/api/docuseal/webhook`,
        submitters: [
          {
            name: client_name.trim(),
            email: submitterEmail,
          },
        ],
      },
    });

    // DocuSeal retourne un tableau de submitters
    const submitter = Array.isArray(docusealResponse) ? docusealResponse[0] : null;
    if (!submitter?.slug || !submitter?.submission_id) {
      return NextResponse.json({ error: 'Reponse DocuSeal invalide' }, { status: 502 });
    }

    // Creer le quote_send en base
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expires_in_days || 14));

    const { error: insertError } = await admin.from('quote_sends').insert({
      user_id: user.id,
      quote_id,
      client_name: client_name.trim(),
      client_email: client_email?.trim() || null,
      token,
      expires_at: expiresAt.toISOString(),
      docuseal_submission_id: submitter.submission_id,
      docuseal_slug: submitter.slug,
    });

    if (insertError) {
      return NextResponse.json({ error: 'Erreur creation du lien' }, { status: 500 });
    }

    // Passer le devis en "envoye" si brouillon
    if (quote.status === 'brouillon') {
      await admin.from('quotes').update({
        status: 'envoye',
        updated_at: new Date().toISOString(),
      }).eq('id', quote_id);
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
    const magicLink = `${base}/d/${token}`;

    // Envoyer l'email au client via Resend
    const resendKey = process.env.RESEND_API_KEY;
    const recipientEmail = client_email?.trim() || client.email;
    if (resendKey && recipientEmail) {
      const resend = new Resend(resendKey);
      const dc = ((artisan.document_config as Record<string, string>) || {});
      const companyName = (artisan.company_name as string) || (artisan.full_name as string) || 'Artisan';

      const fmtTtc = new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
      }).format(Number(quote.total_ttc) || 0);

      const fmtValid = quote.valid_until
        ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(quote.valid_until))
        : null;

      const emailHtml = buildQuoteSignatureEmail({
        clientName: client_name.trim(),
        artisanName: companyName,
        quoteNumber: quote.quote_number,
        quoteTitle: quote.title || '',
        totalTtc: fmtTtc,
        validUntil: fmtValid,
        magicLink,
        accentColor: dc.primary_color || '#d35400',
      });

      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hellobat <signature@hellobat.app>';

      await resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject: `Devis ${quote.quote_number} — ${companyName}`,
        html: emailHtml,
      }).catch((emailErr) => {
        // Log mais ne bloque pas le flow
        console.error('Resend email error:', emailErr);
      });
    }

    return NextResponse.json({ magic_link: magicLink, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
