import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  claimedTtc,
  fetchCreditNotesByInvoice,
  fetchDepositsNetTtc,
  isCreditNote,
  netDueTtc,
  sumCreditNotesTtc,
} from '@/lib/invoices/credit-notes';

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

  const { amount_cents: bodyAmountCents, description, invoice_id } = await request.json();

  // La metadata { invoice_id, source: 'hellopay' } posée sur le PaymentIntent est
  // exactement ce que le webhook HelloPay utilise pour passer la facture à
  // « payée » : dès qu'un invoice_id est fourni, le montant doit venir de la
  // base et pas du body, sinon une requête forgée encaisse un montant arbitraire
  // et solde quand même la facture.
  let amountCents: number;
  let invoiceMetadata: { invoice_id: string } | null = null;

  if (invoice_id) {
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('id, total_ttc, status, invoice_type, quote_id')
      .eq('id', invoice_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
    }

    // Un avoir rembourse le client : il n'est jamais encaissable.
    if (isCreditNote(invoice)) {
      return NextResponse.json(
        { error: 'Un avoir ne peut pas être encaissé' },
        { status: 400 },
      );
    }

    if (invoice.status === 'payee' || invoice.status === 'annulee') {
      return NextResponse.json(
        { error: 'Cette facture est déjà payée ou annulée' },
        { status: 400 },
      );
    }

    // Facture de solde : elle stocke le total brut du devis, on ne réclame
    // que le reste après acomptes (eux-mêmes nets de leurs avoirs).
    const depositsTtc =
      invoice.invoice_type === 'solde' && invoice.quote_id
        ? await fetchDepositsNetTtc(supabaseAdmin, invoice.quote_id)
        : 0;

    // Net d'avoirs : on n'encaisse jamais un montant déjà crédité.
    const creditNotes = (await fetchCreditNotesByInvoice(supabaseAdmin, [invoice.id])).get(invoice.id) || [];
    const creditedTtc = sumCreditNotesTtc(creditNotes);
    amountCents = Math.round(
      netDueTtc({ total_ttc: claimedTtc(invoice, depositsTtc) }, creditNotes) * 100,
    );

    if (amountCents <= 0) {
      return NextResponse.json(
        {
          error: creditedTtc < 0
            ? 'Cette facture a été intégralement créditée par un avoir'
            : 'Cette facture ne comporte aucun montant à régler',
        },
        { status: 400 },
      );
    }

    invoiceMetadata = { invoice_id: invoice.id };
  } else {
    // Encaissement libre, sans facture rattachée : aucun document n'est soldé
    // derrière, le montant saisi par l'artisan fait foi.
    amountCents = Math.round(Number(bodyAmountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
    }
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
  const feeCents = Math.round(amountCents * feePercent / 100);

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        application_fee_amount: feeCents,
        description: description || 'HelloPay',
        metadata: {
          ...(invoiceMetadata || {}),
          source: 'hellopay',
        },
      },
      { stripeAccount: connection.stripe_account_id },
    );

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      // Montant réellement débité : l'appelant doit afficher celui-ci, jamais
      // le total brut de la facture.
      amount_cents: amountCents,
      stripe_account_id: connection.stripe_account_id,
      publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur Stripe' },
      { status: 500 },
    );
  }
}
