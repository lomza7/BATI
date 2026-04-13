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

  const { invoice_id } = await request.json();
  if (!invoice_id) {
    return NextResponse.json({ error: 'invoice_id requis' }, { status: 400 });
  }

  // Fetch invoice (must belong to this user)
  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, title, total_ttc, status, invoice_type, quote_id')
    .eq('id', invoice_id)
    .eq('user_id', user.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  }

  if (invoice.status === 'payee') {
    return NextResponse.json({ error: 'Cette facture est déjà payée' }, { status: 400 });
  }

  // Pour les factures de solde : déduire les acomptes non annulés
  let effectiveTotalTtc = Number(invoice.total_ttc);
  if (invoice.invoice_type === 'solde' && invoice.quote_id) {
    const { data: deposits } = await supabaseAdmin
      .from('invoices')
      .select('total_ttc')
      .eq('quote_id', invoice.quote_id)
      .eq('invoice_type', 'acompte')
      .neq('status', 'annulee');
    const deducted = (deposits || []).reduce(
      (sum, d) => sum + Number(d.total_ttc || 0),
      0,
    );
    effectiveTotalTtc = Math.max(0, Number(invoice.total_ttc) - deducted);
  }

  if (effectiveTotalTtc <= 0) {
    return NextResponse.json({ error: 'Cette facture ne comporte aucun montant à régler' }, { status: 400 });
  }

  // Fetch artisan's Stripe connection
  const { data: connection } = await supabaseAdmin
    .from('stripe_connections')
    .select('stripe_account_id, charges_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!connection?.stripe_account_id || !connection.charges_enabled) {
    return NextResponse.json({ error: 'Compte Stripe non connecté ou non activé' }, { status: 400 });
  }

  // Get platform commission
  const { data: config } = await supabaseAdmin
    .from('platform_config')
    .select('value')
    .eq('key', 'stripe_connect_fee_percent')
    .maybeSingle();

  const feePercent = parseFloat(config?.value || '0.5');
  const amountCents = Math.round(effectiveTotalTtc * 100);
  const feeCents = Math.round(amountCents * feePercent / 100);

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'eur',
        payment_method_types: ['card_present'],
        application_fee_amount: feeCents,
        description: `${invoice.invoice_number} — ${invoice.title}`,
        metadata: {
          invoice_id: invoice.id,
          source: 'hellobat_terminal',
        },
      },
      { stripeAccount: connection.stripe_account_id },
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur Stripe' },
      { status: 500 },
    );
  }
}
