import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const COOKIE_NAME = 'hellobat_stripe_uid';

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Configuration Stripe manquante' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Session utilisateur requise' }, { status: 401 });
  }

  let returnTo = '/paiements';
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.return_to === 'string') returnTo = body.return_to;
  } catch {}

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error: authError } = await sb.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: 'Session utilisateur introuvable' }, { status: 401 });
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

    const { data: existing } = await supabaseAdmin
      .from('stripe_connections')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let accountId: string;

    if (existing?.stripe_account_id) {
      accountId = existing.stripe_account_id;
    } else {
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
      refresh_url: `${siteUrl}${returnTo}?stripe_refresh=1`,
      return_url: `${siteUrl}/api/stripe/connect/callback?return_to=${encodeURIComponent(returnTo)}`,
      type: 'account_onboarding',
      collection_options: { fields: 'eventually_due' },
    });

    const response = NextResponse.json({ redirect_url: accountLink.url });

    response.cookies.set(COOKIE_NAME, user.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 30,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur Stripe' },
      { status: 500 },
    );
  }
}
