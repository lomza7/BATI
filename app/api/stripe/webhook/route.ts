import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getNextInvoiceNumber } from '@/lib/document-numbers';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_2,
    process.env.STRIPE_WEBHOOK_SECRET_3,
  ].filter((s): s is string => Boolean(s));

  if (!stripeKey || secrets.length === 0) {
    return NextResponse.json({ error: 'Configuration Stripe manquante' }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret);
      break;
    } catch {
      // try next secret
    }
  }
  if (!event) {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  // Idempotence: Stripe peut renvoyer un event plusieurs fois (retries,
  // double webhooks). On enregistre event.id dans stripe_webhook_events
  // via INSERT conditionnel; si la ligne existe deja, on skippe.
  const { error: eventInsertErr } = await supabaseAdmin
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type });
  if (eventInsertErr) {
    // 23505 = unique violation -> deja traite, safe skip.
    if ((eventInsertErr as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error('[stripe/webhook] idempotence insert error', eventInsertErr);
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

      // Credit pack purchase (one-shot payment)
      if (session.metadata?.kind === 'credits_pack' && session.metadata?.user_id) {
        await creditPackPurchase({
          userId: session.metadata.user_id,
          credits: Number(session.metadata.credits || 0),
          sessionId: session.id,
        });
      }

      // Subscription started via checkout — sync plan/status
      if (session.mode === 'subscription' && session.metadata?.user_id) {
        const customerId = typeof session.customer === 'string' ? session.customer : null;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        await activateProSubscription({
          userId: session.metadata.user_id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
        // Note: applyReferralReward est desormais declenche sur
        // invoice.payment_succeeded (premier paiement reel, pas pendant le trial).
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscriptionStatus(sub);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await downgradeToFree(sub);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
      if (customerId) {
        await supabaseAdmin
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', customerId);
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
      if (!customerId) break;

      // Re-activer l'abonnement si l'artisan a regularise apres past_due.
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, pending_referral_code, subscription_status, referral_credit_months')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (!profile) break;

      if (profile.subscription_status === 'past_due') {
        await supabaseAdmin
          .from('profiles')
          .update({ subscription_status: 'active' })
          .eq('id', profile.id);
      }

      // Referral : on credite le parrain uniquement quand l'artisan paie
      // reellement (pas pendant le trial gratuit).
      if (profile.pending_referral_code) {
        await applyReferralReward({
          referredUserId: profile.id,
          referralCode: profile.pending_referral_code,
        });
      }

      // Decrementer les mois de credit referral du parrain a chaque mois
      // paye (un mois de gratuite consomme = -1).
      if (profile.referral_credit_months && profile.referral_credit_months > 0) {
        await supabaseAdmin
          .from('profiles')
          .update({ referral_credit_months: Math.max(0, profile.referral_credit_months - 1) })
          .eq('id', profile.id);
      }
      break;
    }

    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const isTerminal = (intent.payment_method_types || []).includes('card_present');
      if (!isTerminal) break;

      const invoiceId = intent.metadata?.invoice_id;
      const connectedAccountId = event.account; // set on Connect events

      if (invoiceId) {
        // Payment initiated from Hellobat Terminal — mark invoice paid
        await supabaseAdmin.rpc('mark_invoice_paid', {
          p_invoice_id: invoiceId,
          p_payment_intent_id: intent.id,
          p_checkout_session_id: '',
        });
        // Override payment_method to 'terminal' (RPC sets 'stripe')
        await supabaseAdmin
          .from('invoices')
          .update({ payment_method: 'terminal' })
          .eq('id', invoiceId);
      } else if (connectedAccountId) {
        // Payment made outside Hellobat (artisan used Stripe app directly)
        // → create a draft invoice for traceability
        await createDraftInvoiceFromTerminal(intent, connectedAccountId);
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

async function creditPackPurchase(args: { userId: string; credits: number; sessionId: string }) {
  if (args.credits <= 0) return;
  try {
    // Idempotence : si on a déjà enregistré cette session, on ne re-crédite pas.
    const { data: existing } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('stripe_session_id', args.sessionId)
      .maybeSingle();
    if (existing) return;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('ai_credits_balance')
      .eq('id', args.userId)
      .maybeSingle();

    const current = profile?.ai_credits_balance ?? 0;
    await supabaseAdmin
      .from('profiles')
      .update({ ai_credits_balance: current + args.credits })
      .eq('id', args.userId);

    await supabaseAdmin.from('credit_transactions').insert({
      user_id: args.userId,
      delta: args.credits,
      kind: 'purchase',
      stripe_session_id: args.sessionId,
    });
  } catch (e) {
    console.error('creditPackPurchase error', e);
  }
}

async function activateProSubscription(args: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}) {
  try {
    const update: Record<string, unknown> = {
      plan: 'pro',
      subscription_status: 'active',
    };
    if (args.stripeCustomerId) update.stripe_customer_id = args.stripeCustomerId;
    if (args.stripeSubscriptionId) update.stripe_subscription_id = args.stripeSubscriptionId;
    await supabaseAdmin.from('profiles').update(update).eq('id', args.userId);
  } catch (e) {
    console.error('activateProSubscription error', e);
  }
}

async function syncSubscriptionStatus(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : null;
  if (!customerId) return;

  // Stripe status → notre enum
  let status: 'active' | 'past_due' | 'canceled' | 'trialing' = 'active';
  if (sub.status === 'past_due' || sub.status === 'unpaid') status = 'past_due';
  else if (sub.status === 'canceled' || sub.status === 'incomplete_expired') status = 'canceled';
  else if (sub.status === 'trialing') status = 'trialing';
  // active, incomplete → 'active' (incomplete = checkout réussi en attente 3DS)

  const plan = status === 'canceled' ? 'free' : 'pro';

  await supabaseAdmin
    .from('profiles')
    .update({
      plan,
      subscription_status: status,
      stripe_subscription_id: sub.id,
    })
    .eq('stripe_customer_id', customerId);
}

async function downgradeToFree(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : null;
  if (!customerId) return;
  await supabaseAdmin
    .from('profiles')
    .update({ plan: 'free', subscription_status: 'canceled' })
    .eq('stripe_customer_id', customerId);
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

/**
 * Crée une facture brouillon quand un paiement Terminal est détecté
 * sans invoice_id dans les metadata (= paiement fait hors Hellobat).
 */
async function createDraftInvoiceFromTerminal(
  intent: Stripe.PaymentIntent,
  stripeAccountId: string,
) {
  try {
    // Avoid duplicates: check if we already created an invoice for this PI
    const { data: existing } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('stripe_payment_intent_id', intent.id)
      .maybeSingle();
    if (existing) return;

    // Find the user who owns this connected account
    const { data: connection } = await supabaseAdmin
      .from('stripe_connections')
      .select('user_id')
      .eq('stripe_account_id', stripeAccountId)
      .maybeSingle();
    if (!connection) return;

    const userId = connection.user_id;
    const amountTtc = (intent.amount || 0) / 100;
    const title = intent.description || 'Paiement Terminal';

    const invoiceNumber = await getNextInvoiceNumber(supabaseAdmin, userId);

    await supabaseAdmin.from('invoices').insert({
      user_id: userId,
      invoice_number: invoiceNumber,
      title,
      status: 'brouillon',
      total_ht: amountTtc, // Approximation — l'artisan devra ajuster
      total_ttc: amountTtc,
      tva_rate: 0,
      payment_method: 'terminal',
      stripe_payment_intent_id: intent.id,
      paid_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('createDraftInvoiceFromTerminal error', e);
  }
}
