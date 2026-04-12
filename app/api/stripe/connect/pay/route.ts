import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Configuration Stripe manquante' }, { status: 503 });
  }

  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ error: 'Token requis' }, { status: 400 });
  }

  // Fetch invoice_send by token
  const { data: send } = await supabaseAdmin
    .from('invoice_sends')
    .select('id, invoice_id, user_id, expires_at, paid_at')
    .eq('token', token)
    .maybeSingle();

  if (!send) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  if (new Date(send.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Ce lien a expire' }, { status: 410 });
  }

  if (send.paid_at) {
    return NextResponse.json({ error: 'Cette facture est deja payee' }, { status: 400 });
  }

  // Fetch invoice
  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, title, total_ttc, status, invoice_type, quote_id')
    .eq('id', send.invoice_id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  }

  if (invoice.status === 'payee') {
    return NextResponse.json({ error: 'Cette facture est deja payee' }, { status: 400 });
  }

  // Pour les factures de solde : on calcule le reste à payer en déduisant les
  // acomptes liés non annulés. C'est volontairement recalculé à la lecture
  // (pas stocké) pour rester correct si un acompte est annulé après coup.
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
    return NextResponse.json(
      { error: 'Cette facture ne comporte aucun montant à régler' },
      { status: 400 },
    );
  }

  // Fetch artisan's Stripe connection
  const { data: connection } = await supabaseAdmin
    .from('stripe_connections')
    .select('stripe_account_id, charges_enabled')
    .eq('user_id', send.user_id)
    .maybeSingle();

  if (!connection?.stripe_account_id || !connection.charges_enabled) {
    return NextResponse.json({ error: 'Le paiement en ligne n\'est pas disponible pour cette facture' }, { status: 400 });
  }

  // Get platform commission
  const { data: config } = await supabaseAdmin
    .from('platform_config')
    .select('value')
    .eq('key', 'stripe_connect_fee_percent')
    .maybeSingle();

  const feePercent = parseFloat(config?.value || '2.5');
  const amountCents = Math.round(effectiveTotalTtc * 100);
  const feeCents = Math.round(amountCents * feePercent / 100);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${invoice.invoice_number} — ${invoice.title}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: feeCents,
        transfer_data: {
          destination: connection.stripe_account_id,
        },
      },
      success_url: `${siteUrl}/f/${token}?payment=success`,
      cancel_url: `${siteUrl}/f/${token}?payment=cancel`,
      metadata: {
        invoice_id: invoice.id,
        invoice_send_id: send.id,
        token,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur Stripe' },
      { status: 500 },
    );
  }
}
