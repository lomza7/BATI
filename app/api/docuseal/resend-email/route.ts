import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildQuoteSignatureEmail } from '@/lib/email-templates';
import { resolveFromEmail } from '@/lib/email-from';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 503 });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { quote_id } = await request.json();
    if (!quote_id) {
      return NextResponse.json({ error: 'quote_id requis' }, { status: 400 });
    }

    // Recuperer le dernier envoi pour ce devis
    const { data: send } = await admin
      .from('quote_sends')
      .select('*')
      .eq('quote_id', quote_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!send) {
      return NextResponse.json({ error: 'Aucun envoi trouve pour ce devis' }, { status: 404 });
    }

    const recipientEmail = send.client_email;
    if (!recipientEmail) {
      return NextResponse.json({ error: 'Pas d\'email client pour cet envoi' }, { status: 400 });
    }

    // Recuperer le devis et le profil artisan
    const [quoteRes, profileRes] = await Promise.all([
      admin.from('quotes').select('*').eq('id', quote_id).is('deleted_at', null).single(),
      admin.from('profiles').select('company_name, full_name, document_config').eq('id', user.id).single(),
    ]);

    if (!quoteRes.data) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    const quote = quoteRes.data;
    const artisanRaw = profileRes.data || { company_name: 'Artisan', full_name: null, document_config: null };
    const dc = ((artisanRaw.document_config as Record<string, string>) || {});
    const companyName = artisanRaw.company_name || artisanRaw.full_name || 'Artisan';

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
    const magicLink = `${base}/d/${send.token}`;

    const fmtTtc = new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
    }).format(Number(quote.total_ttc) || 0);

    const fmtValid = quote.valid_until
      ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(quote.valid_until))
      : null;

    const emailHtml = buildQuoteSignatureEmail({
      clientName: send.client_name,
      artisanName: companyName,
      quoteNumber: quote.quote_number,
      quoteTitle: quote.title || '',
      totalTtc: fmtTtc,
      validUntil: fmtValid,
      magicLink,
      accentColor: dc.primary_color || '#d35400',
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY manquante' }, { status: 503 });
    }

    const resend = new Resend(resendKey);
    const fromEmail = resolveFromEmail('Hellobat <signature@hellobat.app>');

    // Resend SDK v6+ retourne { data, error } — vérifier explicitement pour ne
    // pas avaler silencieusement les échecs de délivrabilité.
    const result = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      ...(user.email ? { cc: user.email } : {}),
      subject: `Rappel : Devis ${quote.quote_number} — ${companyName}`,
      html: emailHtml,
    });

    if (result.error) {
      console.error('[resend-email] Resend API error:', result.error);
      return NextResponse.json(
        { error: result.error.message || 'Échec de l\'envoi email' },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, email_provider_id: result.data?.id || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
