import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const COOKIE_NAME = 'hellobat_stripe_uid';

export async function GET(request: NextRequest) {
  const errorUrl = new URL('/paiements', request.url);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    errorUrl.searchParams.set('stripe_error', 'Configuration Stripe manquante');
    return NextResponse.redirect(errorUrl);
  }

  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    errorUrl.searchParams.set('stripe_error', 'Session utilisateur requise');
    return NextResponse.redirect(errorUrl);
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error: authError } = await sb.auth.getUser(token);

  if (authError || !user) {
    errorUrl.searchParams.set('stripe_error', 'Session utilisateur introuvable');
    return NextResponse.redirect(errorUrl);
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

    // Check if user already has a stripe connection
    const { data: existing } = await supabaseAdmin
      .from('stripe_connections')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let accountId: string;

    if (existing?.stripe_account_id) {
      accountId = existing.stripe_account_id;
    } else {
      // Create new Standard account
      const account = await stripe.accounts.create({
        type: 'standard',
        country: 'FR',
        email: user.email,
        default_currency: 'eur',
      });
      accountId = account.id;

      await supabaseAdmin.from('stripe_connections').upsert({
        user_id: user.id,
        stripe_account_id: accountId,
      }, { onConflict: 'user_id' });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/api/stripe/connect?token=${token}`,
      return_url: `${siteUrl}/api/stripe/connect/callback`,
      type: 'account_onboarding',
      collection_options: { fields: 'eventually_due' },
    });

    const response = NextResponse.redirect(accountLink.url);

    // Store userId in a secure cookie so callback can read it
    response.cookies.set(COOKIE_NAME, user.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 30, // 30 min
    });

    return response;
  } catch (error) {
    errorUrl.searchParams.set('stripe_error', error instanceof Error ? error.message : 'Erreur Stripe');
    return NextResponse.redirect(errorUrl);
  }
}
