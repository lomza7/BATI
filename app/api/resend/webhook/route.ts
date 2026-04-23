import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * Webhook Resend — événements de délivrabilité.
 *
 * Configurable dans le dashboard Resend → Webhooks → Add endpoint :
 *   URL : https://hellobat.app/api/resend/webhook
 *   Secret : stocké dans RESEND_WEBHOOK_SECRET (Vercel env)
 *   Events : email.sent, email.delivered, email.bounced, email.complained
 *
 * Événements utiles ici :
 *   - email.delivered → le MX destinataire a accepté
 *   - email.bounced   → rejet définitif (adresse invalide, boîte pleine…)
 *   - email.complained → marqué comme spam par le destinataire
 *
 * On lookup la ligne par `email_provider_id` dans invoice_sends OU
 * quote_sends (une des deux matchera, ou aucune si l'email provient
 * d'un autre flow : support, signup, referral…).
 */

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { message?: string };
    reason?: string;
  };
}

function verifySignature(raw: string, headers: Headers, secret: string): boolean {
  // Resend utilise Svix — signature au format `v1,<base64>` dans `svix-signature`.
  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const signedPayload = `${svixId}.${svixTimestamp}.${raw}`;
  const secretBytes = Buffer.from(
    secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret,
    'base64',
  );
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(signedPayload, 'utf8')
    .digest('base64');

  // svix-signature peut contenir plusieurs signatures séparées par espaces
  return svixSignature
    .split(' ')
    .map((s) => s.split(',')[1])
    .some((sig) => {
      if (!sig) return false;
      try {
        return crypto.timingSafeEqual(
          Buffer.from(sig, 'base64'),
          Buffer.from(expected, 'base64'),
        );
      } catch {
        return false;
      }
    });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (secret) {
    if (!verifySignature(raw, request.headers, secret)) {
      return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
    }
  } else {
    console.warn('[resend/webhook] RESEND_WEBHOOK_SECRET manquant — vérification signature désactivée');
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ received: true, reason: 'no email_id' });
  }

  // Map event.type → email_status
  let newStatus: string | null = null;
  const timestampColumn: Record<string, string> = {
    'email.delivered': 'email_delivered_at',
    'email.bounced': 'email_bounced_at',
  };
  switch (event.type) {
    case 'email.delivered':
      newStatus = 'delivered';
      break;
    case 'email.bounced':
      newStatus = 'bounced';
      break;
    case 'email.complained':
      newStatus = 'complained';
      break;
    case 'email.sent':
      // Déjà tracké côté API route (emailStatus='sent'). On ne touche pas
      // pour ne pas régresser en cas de réorder des webhooks.
      return NextResponse.json({ received: true, noop: true });
    default:
      return NextResponse.json({ received: true, noop: true });
  }

  const update: Record<string, string> = { email_status: newStatus };
  const reason =
    event.data?.bounce?.message ||
    event.data?.reason ||
    (newStatus === 'complained' ? 'Signalé comme spam' : '');
  if (reason) update.email_error = reason;
  if (timestampColumn[event.type]) {
    update[timestampColumn[event.type]] = new Date().toISOString();
  }

  // Essaye invoice_sends puis quote_sends (un seul matchera par email_id).
  const [invRes, quoteRes] = await Promise.all([
    supabaseAdmin
      .from('invoice_sends')
      .update(update)
      .eq('email_provider_id', emailId)
      .select('id'),
    supabaseAdmin
      .from('quote_sends')
      .update(update)
      .eq('email_provider_id', emailId)
      .select('id'),
  ]);

  const matched = (invRes.data?.length || 0) + (quoteRes.data?.length || 0);
  return NextResponse.json({ received: true, matched, status: newStatus });
}
