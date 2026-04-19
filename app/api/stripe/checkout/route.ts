import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { resolveStripePrice } from '../utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { apiError } from '@/lib/api-errors';

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
    // Auth serveur: on ne fait jamais confiance au user_id/email du body.
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }
    const user_id = user.id;
    const user_email = user.email;

    const { price_id, success_url, cancel_url, promo_code } = await request.json();

    if (!price_id) {
      return NextResponse.json({ error: 'price_id requis' }, { status: 400 });
    }

    // Anti-tampering : le price_id recu doit correspondre a un des price Stripe
    // declares dans platform_config (pro/business/starter). Bloque quelqu'un
    // qui forgerait un price_id a 0.01€.
    const { data: configRows } = await supabaseAdmin
      .from('platform_config')
      .select('key, value')
      .in('key', ['stripe_price_starter', 'stripe_price_pro', 'stripe_price_business']);
    const allowedPrices = new Set(
      (configRows || []).map((r) => r.value).filter(Boolean),
    );
    if (allowedPrices.size > 0 && !allowedPrices.has(price_id)) {
      return NextResponse.json({ error: 'price_id non autorise' }, { status: 403 });
    }

    const resolvedPrice = await resolveStripePrice(stripe, price_id);

    // Look up referral state and accumulated credit months for the buyer
    let trialDays = 0;
    let referralCode: string | null = null;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('pending_referral_code, referral_credit_months')
      .eq('id', user_id)
      .maybeSingle();

    if (profile) {
      if (profile.pending_referral_code) {
        const { data: signup } = await supabaseAdmin
          .from('referral_signups')
          .select('id, referred_credit_granted')
          .eq('referred_user_id', user_id)
          .maybeSingle();
        if (signup && !signup.referred_credit_granted) {
          trialDays += 60;
          referralCode = profile.pending_referral_code;
        }
      }
      if (profile.referral_credit_months && profile.referral_credit_months > 0) {
        trialDays += profile.referral_credit_months * 30;
      }
    }

    // Code promo saisi au signup (ou ailleurs) : on résout le code
    // customer-facing vers son promotionCode.id Stripe, puis on le passe
    // en `discounts`. Stripe interdit `discounts` + `allow_promotion_codes`
    // simultanément, donc on switch entre les deux.
    let resolvedPromotionCodeId: string | null = null;
    let resolvedPromotionCode: string | null = null;
    if (typeof promo_code === 'string' && promo_code.trim().length > 0) {
      try {
        const list = await stripe.promotionCodes.list({
          code: promo_code.trim().toUpperCase(),
          active: true,
          limit: 1,
        });
        if (list.data[0]) {
          resolvedPromotionCodeId = list.data[0].id;
          resolvedPromotionCode = list.data[0].code;
        }
      } catch {
        // Silencieux : si le code est invalide/inconnu, on retombe sur
        // `allow_promotion_codes: true` (champ dans l'UI Stripe).
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      locale: 'fr',
      payment_method_types: ['card'],
      customer_email: user_email,
      line_items: [{ price: resolvedPrice.id, quantity: 1 }],
      ...(resolvedPromotionCodeId
        ? { discounts: [{ promotion_code: resolvedPromotionCodeId }] }
        : { allow_promotion_codes: true }),
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      success_url: success_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app'}/dashboard?checkout=success`,
      cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app'}/dashboard?checkout=cancel`,
      ...(trialDays > 0
        ? { subscription_data: { trial_period_days: trialDays } }
        : {}),
      metadata: {
        user_id,
        stripe_input_id: price_id,
        stripe_price_id: resolvedPrice.id,
        referral_code: referralCode || '',
        referral_trial_days: trialDays > 0 ? String(trialDays) : '',
        promo_code: resolvedPromotionCode || '',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    return apiError('EXTERNAL_API', {
      message: 'Impossible de creer la session de paiement.',
      cause: e,
      context: { route: 'stripe/checkout' },
    });
  }
}
