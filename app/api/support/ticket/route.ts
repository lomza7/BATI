import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const ADMIN_TO_EMAIL = 'louis@hellobat.app';

const AttachmentSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(200),
  mime: z.string().min(1).max(100),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
});

const TicketSchema = z.object({
  type: z.enum(['bug', 'question', 'amelioration']),
  message: z.string().trim().min(5).max(5000),
  page_url: z.string().trim().max(500).optional().default(''),
  attachments: z.array(AttachmentSchema).max(3).optional().default([]),
});

const TYPE_LABELS: Record<'bug' | 'question' | 'amelioration', string> = {
  bug: 'Bug',
  question: 'Question',
  amelioration: 'Amélioration',
};

const TYPE_EMOJI: Record<'bug' | 'question' | 'amelioration', string> = {
  bug: '🐛',
  question: '❓',
  amelioration: '💡',
};

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

  // Auth obligatoire : on veut savoir qui a soumis (contexte complet).
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const token = authHeader.slice(7).trim();

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Rate-limit par user (pas par IP) — 10 tickets / heure suffit largement.
  const rl = checkRateLimit(`support-ticket:user:${user.id}`, 10, 60 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = TicketSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs invalides' }, { status: 400 });
  }
  const body = parsed.data;

  const userAgent = request.headers.get('user-agent') || '';

  // Snapshot profil pour ne pas dépendre de mises à jour ultérieures.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, company_name, company_phone')
    .eq('id', user.id)
    .maybeSingle();

  const snapshot = {
    user_email: user.email || '',
    user_full_name: profile?.full_name || '',
    user_phone: profile?.company_phone || '',
    company_name: profile?.company_name || '',
  };

  // Les attachments ont été uploadés avant via /upload. On vérifie que
  // chaque path appartient bien au user courant pour éviter qu'un user
  // référence le fichier d'un autre.
  const attachments = (body.attachments || []).filter((att) =>
    att.path.startsWith(`${user.id}/`),
  );

  // Insert ticket
  const { data: ticket, error: insertErr } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      user_id: user.id,
      type: body.type,
      message: body.message,
      ...snapshot,
      page_url: body.page_url || '',
      user_agent: userAgent.slice(0, 500),
      attachments,
    })
    .select('id, created_at')
    .single();

  if (insertErr || !ticket) {
    console.error('[support/ticket] insert error', insertErr);
    return NextResponse.json({ error: 'Impossible d\'enregistrer votre demande' }, { status: 500 });
  }

  // Génère des signed URLs (30j) pour l'email admin.
  let attachmentLinks: Array<{ name: string; url: string; mime: string; size: number }> = [];
  if (attachments.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from('support-attachments')
      .createSignedUrls(attachments.map((a) => a.path), 60 * 60 * 24 * 30);
    attachmentLinks = (signed || []).map((s, i) => ({
      name: attachments[i].name,
      mime: attachments[i].mime,
      size: attachments[i].size,
      url: s.signedUrl,
    }));
  }

  // Email admin (best-effort, on ne fail pas le ticket si l'email échoue)
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (resendKey && fromEmail) {
    try {
      const resend = new Resend(resendKey);
      const typeLabel = TYPE_LABELS[body.type];
      const emoji = TYPE_EMOJI[body.type];

      const html = `
        <div style="font-family: system-ui, -apple-system, sans-serif; color: #111; max-width: 640px;">
          <h2 style="margin: 0 0 16px; font-size: 18px;">${emoji} ${typeLabel} · Nouveau ticket support</h2>
          <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #666; width: 160px;">Utilisateur</td><td style="padding: 6px 0;"><strong>${escapeHtml(snapshot.user_full_name || snapshot.user_email)}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Email</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(snapshot.user_email)}">${escapeHtml(snapshot.user_email)}</a></td></tr>
            ${snapshot.user_phone ? `<tr><td style="padding: 6px 0; color: #666;">Téléphone</td><td style="padding: 6px 0;"><a href="tel:${escapeHtml(snapshot.user_phone)}">${escapeHtml(snapshot.user_phone)}</a></td></tr>` : ''}
            ${snapshot.company_name ? `<tr><td style="padding: 6px 0; color: #666;">Entreprise</td><td style="padding: 6px 0;">${escapeHtml(snapshot.company_name)}</td></tr>` : ''}
            <tr><td style="padding: 6px 0; color: #666;">User ID</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${user.id}</td></tr>
            ${body.page_url ? `<tr><td style="padding: 6px 0; color: #666;">Page</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${escapeHtml(body.page_url)}</td></tr>` : ''}
          </table>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.5; background: #f9fafb; padding: 12px; border-radius: 8px;">${escapeHtml(body.message)}</div>
          ${attachmentLinks.length > 0 ? `
            <div style="margin: 16px 0 0;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #666; font-weight: 500;">Pièces jointes (${attachmentLinks.length})</p>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                ${attachmentLinks.map((a) => `
                  <li>
                    <a href="${a.url}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a>
                    <span style="color: #888; font-size: 12px;"> · ${Math.round(a.size / 1024)} Ko · ${escapeHtml(a.mime)}</span>
                  </li>
                `).join('')}
              </ul>
              <p style="margin: 6px 0 0; font-size: 11px; color: #888;">Liens valides 30 jours.</p>
            </div>
          ` : ''}
          <p style="margin: 20px 0 0; font-size: 12px; color: #888;">
            Ticket ID : <code>${ticket.id}</code><br />
            Ouvrir dans l'admin : <a href="https://hellobat.app/admin/support">hellobat.app/admin/support</a>
          </p>
        </div>
      `;

      const subject = `[Support ${typeLabel}] ${snapshot.company_name || snapshot.user_email} — ${body.message.slice(0, 60)}${body.message.length > 60 ? '…' : ''}`;

      await resend.emails.send({
        from: fromEmail,
        to: ADMIN_TO_EMAIL,
        replyTo: snapshot.user_email,
        subject,
        html,
        text: `${typeLabel} de ${snapshot.user_full_name || snapshot.user_email} (${snapshot.user_email})\nTél: ${snapshot.user_phone || '-'}\nEntreprise: ${snapshot.company_name || '-'}\nPage: ${body.page_url || '-'}\n\n${body.message}\n\nTicket ${ticket.id}`,
      });
    } catch (e) {
      console.error('[support/ticket] email send failed (ticket still saved)', e);
    }
  } else {
    console.warn('[support/ticket] RESEND_API_KEY/FROM_EMAIL manquants — email non envoyé');
  }

  return NextResponse.json({ success: true, ticket_id: ticket.id });
}
