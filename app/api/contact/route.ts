import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { resolveFromEmail } from '@/lib/email-from';

export const runtime = 'nodejs';

const CONTACT_TO_EMAIL = 'louis@hellobat.app';

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(5).max(5000),
  turnstile_token: z.string().optional(),
  // Honeypot — doit rester vide pour un humain
  company_website: z.string().optional(),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`contact:ip:${ip}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs invalides' }, { status: 400 });
  }
  const body = parsed.data;

  if (body.company_website && body.company_website.trim().length > 0) {
    return NextResponse.json({ success: true });
  }

  const turnstile = await verifyTurnstile(body.turnstile_token, ip);
  if (!turnstile.ok) {
    return NextResponse.json(
      { error: 'Vérification anti-bot échouée. Rechargez la page et réessayez.' },
      { status: 400 },
    );
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = resolveFromEmail('Hellobat <equipe@hellobat.app>');
  if (!resendKey || !fromEmail) {
    console.error('[contact] RESEND_API_KEY ou RESEND_FROM_EMAIL manquant');
    return NextResponse.json({ error: 'Configuration email manquante' }, { status: 503 });
  }

  const resend = new Resend(resendKey);

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #111; max-width: 600px;">
      <h2 style="margin: 0 0 16px; font-size: 18px;">Nouveau message depuis hellobat.app</h2>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #666; width: 120px;">Nom</td><td style="padding: 6px 0;">${escapeHtml(body.name)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Email</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(body.email)}">${escapeHtml(body.email)}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Sujet</td><td style="padding: 6px 0;">${escapeHtml(body.subject)}</td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
      <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(body.message)}</div>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: CONTACT_TO_EMAIL,
      replyTo: body.email,
      subject: `[Contact] ${body.subject} — ${body.name}`,
      html,
      text: `${body.name} <${body.email}>\nSujet : ${body.subject}\n\n${body.message}`,
    });

    if (result.error) {
      console.error('[contact] Resend error', result.error);
      return NextResponse.json({ error: 'Envoi impossible' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[contact] send threw', e);
    return NextResponse.json({ error: 'Erreur lors de l\'envoi' }, { status: 500 });
  }
}
