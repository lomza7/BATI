import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { resolveStripePrice } from '../utils';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: 'Variable STRIPE_SECRET_KEY manquante dans .env.local' },
      { status: 503 }
    );
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

  try {
    const { price_id, user_email, user_id, success_url, cancel_url } = await request.json();

    if (!price_id || !user_email) {
      return NextResponse.json({ error: 'price_id et user_email requis' }, { status: 400 });
    }

    const resolvedPrice = await resolveStripePrice(stripe, price_id);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user_email,
      line_items: [{ price: resolvedPrice.id, quantity: 1 }],
      success_url: success_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.batiflow.fr'}/dashboard?checkout=success`,
      cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.batiflow.fr'}/dashboard?checkout=cancel`,
      metadata: {
        user_id: user_id || '',
        stripe_input_id: price_id,
        stripe_price_id: resolvedPrice.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur Stripe';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
