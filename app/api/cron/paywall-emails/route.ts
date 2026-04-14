import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildTrialReminderEmail, buildLowCreditsEmail } from '@/lib/email-templates';

export const runtime = 'nodejs';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
const UPGRADE_URL = `${SITE_URL}/parametres?tab=abonnement`;
const LOW_CREDITS_THRESHOLD = 10;

interface ProfileRow {
  id: string;
  full_name: string | null;
  trial_end_at: string | null;
  subscription_status: string;
  stripe_subscription_id: string | null;
  ai_credits_balance: number;
  plan: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || 'Hellobat <noreply@hellobat.app>';
  try {
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      console.error('[paywall-emails] resend error', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[paywall-emails] send failed', err);
    return false;
  }
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = { trialReminders: 0, lowCredits: 0, errors: 0 };

  // ── Trial reminders (J-7, J-2, J-0) ────────────────────────────────────────
  const { data: trialProfiles, error: trialError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, trial_end_at, subscription_status, stripe_subscription_id')
    .eq('subscription_status', 'trialing')
    .not('trial_end_at', 'is', null);

  if (trialError) {
    console.error('[paywall-emails] trial query error', trialError);
    stats.errors++;
  }

  for (const p of (trialProfiles ?? []) as ProfileRow[]) {
    if (p.stripe_subscription_id || !p.trial_end_at) continue;
    const days = daysUntil(p.trial_end_at);
    if (![7, 2, 0].includes(days)) continue;

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
    const email = authUser?.user?.email;
    if (!email) continue;

    const firstName = (p.full_name || email.split('@')[0] || 'artisan').split(' ')[0];
    const html = buildTrialReminderEmail({ firstName, daysLeft: days, upgradeUrl: UPGRADE_URL });
    const subject =
      days >= 7
        ? "Il vous reste 7 jours d'essai Hellobat"
        : days >= 2
          ? `Plus que ${days} jours d'essai Hellobat`
          : 'Votre essai Hellobat est terminé';

    const sent = await sendEmail(email, subject, html);
    if (sent) stats.trialReminders++;
    else stats.errors++;
  }

  // ── Low credits (Pro users with balance < threshold, max 1/mois) ───────────
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: lowProfiles, error: lowError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, ai_credits_balance, plan, subscription_status')
    .eq('plan', 'pro')
    .in('subscription_status', ['active', 'trialing'])
    .lt('ai_credits_balance', LOW_CREDITS_THRESHOLD);

  if (lowError) {
    console.error('[paywall-emails] low credits query error', lowError);
    stats.errors++;
  }

  for (const p of (lowProfiles ?? []) as ProfileRow[]) {
    // Idempotence : un envoi max par période (mois courant)
    const { data: existing } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('user_id', p.id)
      .eq('kind', 'adjustment')
      .eq('metadata->>email_sent_period', period)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
    const email = authUser?.user?.email;
    if (!email) continue;

    const firstName = (p.full_name || email.split('@')[0] || 'artisan').split(' ')[0];
    const html = buildLowCreditsEmail({
      firstName,
      balance: p.ai_credits_balance,
      buyUrl: UPGRADE_URL,
    });

    const sent = await sendEmail(email, 'Votre solde de crédits IA est bas', html);
    if (sent) {
      stats.lowCredits++;
      // Trace l'envoi via une transaction zéro pour idempotence
      await supabaseAdmin.from('credit_transactions').insert({
        user_id: p.id,
        delta: 0,
        kind: 'adjustment',
        metadata: { email_sent_period: period, kind: 'low_balance_notice' },
      });
    } else {
      stats.errors++;
    }
  }

  return NextResponse.json({ ok: true, stats });
}
