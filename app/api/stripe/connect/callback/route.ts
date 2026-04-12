import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const COOKIE_NAME = 'hellobat_stripe_uid';

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
  const returnTo = request.nextUrl.searchParams.get('return_to') || '/paiements';
  const redirectUrl = new URL(returnTo, siteUrl);

  const userId = request.cookies.get(COOKIE_NAME)?.value;
  if (!userId) {
    redirectUrl.searchParams.set('stripe_error', 'Session expirée');
    return NextResponse.redirect(redirectUrl);
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    redirectUrl.searchParams.set('stripe_error', 'Configuration Stripe manquante');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

    const { data: connection } = await supabaseAdmin
      .from('stripe_connections')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!connection?.stripe_account_id) {
      redirectUrl.searchParams.set('stripe_error', 'Connexion Stripe introuvable');
      return NextResponse.redirect(redirectUrl);
    }

    const account = await stripe.accounts.retrieve(connection.stripe_account_id);

    await supabaseAdmin
      .from('stripe_connections')
      .update({
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        onboarding_completed: (account.charges_enabled && account.details_submitted) ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    redirectUrl.searchParams.set('stripe_connected', '1');

    const response = NextResponse.redirect(redirectUrl);
    // Clean up cookie
    response.cookies.delete(COOKIE_NAME);
    return response;
  } catch (error) {
    redirectUrl.searchParams.set('stripe_error', error instanceof Error ? error.message : 'Erreur Stripe');
    return NextResponse.redirect(redirectUrl);
  }
}
