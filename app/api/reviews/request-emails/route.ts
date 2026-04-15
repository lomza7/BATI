import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const token = authHeader.slice(7);

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { clientIds, subject, body } = (await request.json()) as {
    clientIds: string[];
    subject: string;
    body: string; // peut contenir {{nom}} et {{lien}}
  };

  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return NextResponse.json({ error: 'Aucun client sélectionné' }, { status: 400 });
  }
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Sujet et message requis' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!resendKey || !fromEmail) {
    return NextResponse.json({ error: 'Configuration email manquante' }, { status: 503 });
  }

  const [profileRes, clientsRes] = await Promise.all([
    sb.from('profiles').select('company_name, public_review_token, google_review_link').eq('id', user.id).maybeSingle(),
    sb.from('clients').select('id, name, email').eq('user_id', user.id).in('id', clientIds),
  ]);

  const profile = profileRes.data;
  if (!profile?.public_review_token) {
    return NextResponse.json({ error: 'Token public manquant' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
  const reviewLink = `${baseUrl}/avis-public/${profile.public_review_token}`;
  const companyName = profile.company_name || 'Notre entreprise';

  const resend = new Resend(resendKey);
  const recipients = (clientsRes.data || []).filter((c) => c.email);

  let sent = 0;
  const errors: string[] = [];

  for (const c of recipients) {
    const fullName = (c.name ?? '').trim() || 'cher client';
    const personalizedBody = body
      .replace(/\{\{nom\}\}/gi, fullName)
      .replace(/\{\{lien\}\}/gi, reviewLink);

    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
      <p style="white-space:pre-wrap;line-height:1.6;">${personalizedBody.replace(/\n/g, '<br/>')}</p>
      <p style="margin:28px 0;text-align:center;">
        <a href="${reviewLink}" style="background:#D35400;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
          Laisser un avis
        </a>
      </p>
      ${profile.google_review_link ? `<p style="text-align:center;margin:12px 0 0;font-size:13px;color:#666;">Vous pouvez aussi laisser un avis directement sur <a href="${profile.google_review_link}" style="color:#D35400;">Google</a>.</p>` : ''}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;text-align:center;">Envoyé depuis <a href="https://hellobat.app" style="color:#D35400;">Hellobat</a></p>
    </div>`;

    try {
      await resend.emails.send({
        from: `${companyName} via Hellobat <${fromEmail}>`,
        to: c.email!,
        subject,
        html,
      });
      sent += 1;
    } catch (e) {
      errors.push(`${c.email}: ${e instanceof Error ? e.message : 'erreur'}`);
    }
  }

  if (sent > 0) {
    await sb
      .from('clients')
      .update({ last_review_request_at: new Date().toISOString() })
      .in('id', recipients.map((c) => c.id));
  }

  return NextResponse.json({ sent, total: recipients.length, errors });
}
