import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { apiError } from '@/lib/api-errors';
import { resolveStripePrice } from '../utils';

export const runtime = 'nodejs';

type PackKey = '50' | '200' | '1000';
const CONFIG_PRICE_KEYS: Record<PackKey, string> = {
  '50': 'stripe_price_credits_50',
  '200': 'stripe_price_credits_200',
  '1000': 'stripe_price_credits_1000',
};
const CONFIG_AMOUNT_KEYS: Record<PackKey, string> = {
  '50': 'credits_pack_50_amount',
  '200': 'credits_pack_200_amount',
  '1000': 'credits_pack_1000_amount',
};

async function getConfig(key: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('platform_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? '';
}

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 });
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Session requise' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const pack = String(body?.pack || '') as PackKey;
  if (!['50', '200', '1000'].includes(pack)) {
    return NextResponse.json({ error: 'Pack invalide' }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

  const priceId = await getConfig(CONFIG_PRICE_KEYS[pack]);
  const creditsAmount = await getConfig(CONFIG_AMOUNT_KEYS[pack]);

  if (!priceId) {
    return NextResponse.json(
      { error: 'Prix Stripe non configuré pour ce pack. Contactez le support.' },
      { status: 503 },
    );
  }

  try {
    const resolved = await resolveStripePrice(stripe, priceId);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr',
      payment_method_types: ['card'],
      customer_email: user.email ?? undefined,
      line_items: [{ price: resolved.id, quantity: 1 }],
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      invoice_creation: { enabled: true },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app'}/parametres?tab=abonnement&credits=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app'}/parametres?tab=abonnement&credits=cancel`,
      metadata: {
        kind: 'credits_pack',
        user_id: user.id,
        credits: creditsAmount,
        pack,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return apiError('EXTERNAL_API', {
      message: 'Impossible de créer la session de paiement.',
      cause: e,
      context: { route: 'stripe/checkout-credits' },
    });
  }
}
