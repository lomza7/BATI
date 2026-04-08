import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Configuration Stripe manquante' }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId) {
        await supabaseAdmin.rpc('mark_invoice_paid', {
          p_invoice_id: invoiceId,
          p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : '',
          p_checkout_session_id: session.id,
        });
      }

      // Referral reward: subscription mode only
      if (session.mode === 'subscription' && session.metadata?.user_id) {
        await applyReferralReward({
          referredUserId: session.metadata.user_id,
          referralCode: session.metadata?.referral_code || '',
        });
      }
      break;
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      await supabaseAdmin
        .from('stripe_connections')
        .update({
          charges_enabled: account.charges_enabled ?? false,
          payouts_enabled: account.payouts_enabled ?? false,
          details_submitted: account.details_submitted ?? false,
          onboarding_completed: (account.charges_enabled && account.details_submitted) ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', account.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function applyReferralReward(args: { referredUserId: string; referralCode: string }) {
  try {
    // Find the signup row for this referred user
    const { data: signup } = await supabaseAdmin
      .from('referral_signups')
      .select('id, referrer_user_id, referrer_credit_granted, referred_credit_granted, code')
      .eq('referred_user_id', args.referredUserId)
      .maybeSingle();

    if (!signup) return;

    const now = new Date().toISOString();

    // Mark the signup as subscribed and grant the referred-side credit (the trial was applied at checkout)
    await supabaseAdmin
      .from('referral_signups')
      .update({
        subscribed_at: now,
        referred_credit_granted: true,
        referred_credit_granted_at: signup.referred_credit_granted ? null : now,
      })
      .eq('id', signup.id);

    // Credit the referrer with 2 months — only once per signup
    if (!signup.referrer_credit_granted) {
      const { data: referrerProfile } = await supabaseAdmin
        .from('profiles')
        .select('referral_credit_months')
        .eq('id', signup.referrer_user_id)
        .maybeSingle();

      const currentMonths = referrerProfile?.referral_credit_months || 0;

      await supabaseAdmin
        .from('profiles')
        .update({ referral_credit_months: currentMonths + 2 })
        .eq('id', signup.referrer_user_id);

      await supabaseAdmin
        .from('referral_signups')
        .update({
          referrer_credit_granted: true,
          referrer_credit_granted_at: now,
        })
        .eq('id', signup.id);
    }

    // Clear the pending_referral_code so it isn't applied twice
    await supabaseAdmin
      .from('profiles')
      .update({ pending_referral_code: null })
      .eq('id', args.referredUserId);
  } catch (e) {
    console.error('applyReferralReward error', e);
  }
}
