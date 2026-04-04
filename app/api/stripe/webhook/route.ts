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
