import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_HELLOPAY_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Configuration manquante' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;

    // Only process HelloPay payments
    if (pi.metadata?.source !== 'hellopay') {
      return NextResponse.json({ received: true });
    }

    // Mark invoice as paid
    const invoiceId = pi.metadata?.invoice_id;
    if (invoiceId) {
      await supabaseAdmin
        .from('invoices')
        .update({
          status: 'payee',
          paid_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);
    }
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    await supabaseAdmin
      .from('stripe_connections')
      .update({
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        onboarding_completed:
          (account.charges_enabled && account.details_submitted) ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_account_id', account.id);
  }

  return NextResponse.json({ received: true });
}
