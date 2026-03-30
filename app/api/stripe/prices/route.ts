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
    const { price_id } = await request.json();

    if (!price_id || typeof price_id !== 'string') {
      return NextResponse.json({ error: 'price_id requis' }, { status: 400 });
    }

    const price = await resolveStripePrice(stripe, price_id);

    const product = price.product as Stripe.Product;

    return NextResponse.json({
      price_id: price.id,
      input_id: price_id,
      product_id: product.id,
      product_name: product.name,
      amount: (price.unit_amount || 0) / 100,
      currency: price.currency,
      interval: price.recurring?.interval || null,
      active: price.active,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur Stripe';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
