import { NextResponse } from 'next/server';
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
    const { price_id, user_email, user_id, success_url, cancel_url } = await request.json();

    if (!price_id || !user_email) {
      return NextResponse.json({ error: 'price_id et user_email requis' }, { status: 400 });
    }

    const resolvedPrice = await resolveStripePrice(stripe, price_id);

    // Look up referral state and accumulated credit months for the buyer
    let trialDays = 0;
    let referralCode: string | null = null;
    if (user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('pending_referral_code, referral_credit_months')
        .eq('id', user_id)
        .maybeSingle();

      if (profile) {
        // 2 months for the referred user (only if not already granted)
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
        // Plus any accumulated months earned as referrer (30 days per month)
        if (profile.referral_credit_months && profile.referral_credit_months > 0) {
          trialDays += profile.referral_credit_months * 30;
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      locale: 'fr',
      payment_method_types: ['card'],
      customer_email: user_email,
      line_items: [{ price: resolvedPrice.id, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: success_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app'}/dashboard?checkout=success`,
      cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app'}/dashboard?checkout=cancel`,
      ...(trialDays > 0
        ? { subscription_data: { trial_period_days: trialDays } }
        : {}),
      metadata: {
        user_id: user_id || '',
        stripe_input_id: price_id,
        stripe_price_id: resolvedPrice.id,
        referral_code: referralCode || '',
        referral_trial_days: trialDays > 0 ? String(trialDays) : '',
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
