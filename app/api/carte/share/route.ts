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
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { to, companyName, clientName } = (await request.json()) as {
    to: string;
    companyName: string;
    clientName?: string;
  };
  if (!to || !companyName) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!resendKey || !fromEmail) {
    return NextResponse.json({ error: 'Configuration email manquante' }, { status: 503 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
  const link = `${baseUrl}/carte/publique`;
  const greeting = clientName ? `Bonjour ${clientName},` : 'Bonjour,';

  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#D35400;">Nos réalisations</h2>
    <p>${greeting}</p>
    <p>${companyName} vous partage la carte interactive de ses chantiers et réalisations.</p>
    <p style="margin:24px 0;">
      <a href="${link}" style="background:#D35400;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Voir la carte des chantiers
      </a>
    </p>
    <p style="color:#666;font-size:14px;">Vous pouvez consulter la localisation, l'avancement et les détails de nos projets.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#999;font-size:12px;">Envoyé depuis <a href="https://hellobat.app" style="color:#D35400;">Hellobat</a></p>
  </div>`;

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: `${companyName} via Hellobat <${fromEmail}>`,
      to,
      subject: `Découvrez nos chantiers — ${companyName}`,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur envoi' },
      { status: 500 },
    );
  }
}
