import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Configuration Stripe manquante' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const { amount_cents, description, invoice_id } = await request.json();
  if (!amount_cents || amount_cents <= 0) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
  }

  // Fetch artisan's Stripe connection
  const { data: connection } = await supabaseAdmin
    .from('stripe_connections')
    .select('stripe_account_id, charges_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!connection?.stripe_account_id || !connection.charges_enabled) {
    return NextResponse.json({ error: 'Compte Stripe non connecte ou non active' }, { status: 400 });
  }

  // Get platform commission
  const { data: config } = await supabaseAdmin
    .from('platform_config')
    .select('value')
    .eq('key', 'stripe_connect_fee_percent')
    .maybeSingle();

  const feePercent = parseFloat(config?.value || '0.5');
  const feeCents = Math.round(amount_cents * feePercent / 100);

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amount_cents,
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        application_fee_amount: feeCents,
        description: description || 'HelloPay',
        metadata: {
          ...(invoice_id ? { invoice_id } : {}),
          source: 'hellopay',
        },
      },
      { stripeAccount: connection.stripe_account_id },
    );

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

    // Create payment session via RPC (bypasses PostgREST schema cache)
    const { data: sessionId, error: sessionError } = await supabaseAdmin
      .rpc('create_payment_session', {
        p_user_id: user.id,
        p_invoice_id: invoice_id || null,
        p_stripe_account_id: connection.stripe_account_id,
        p_payment_intent_id: paymentIntent.id,
        p_client_secret: paymentIntent.client_secret!,
        p_publishable_key: publishableKey,
        p_amount_cents: amount_cents,
        p_description: description || 'HelloPay',
      });

    if (sessionError || !sessionId) {
      console.error('payment_sessions rpc error', JSON.stringify(sessionError));
      return NextResponse.json({ error: `Erreur creation session: ${sessionError?.message || 'unknown'}` }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
    const payUrl = `${siteUrl}/pay/${sessionId}`;

    return NextResponse.json({
      session_id: sessionId,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      stripe_account_id: connection.stripe_account_id,
      publishable_key: publishableKey,
      pay_url: payUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur Stripe' },
      { status: 500 },
    );
  }
}
