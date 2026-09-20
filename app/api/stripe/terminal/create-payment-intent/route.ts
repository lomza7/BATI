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

  // Un avoir rembourse le client : il ne peut pas être encaissé au terminal.
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

  // Pour les factures de solde : déduire les acomptes non annulés, nets de
  // leurs propres avoirs.
  const depositsTtc =
    invoice.invoice_type === 'solde' && invoice.quote_id
      ? await fetchDepositsNetTtc(supabaseAdmin, invoice.quote_id)
      : 0;

  // Avoirs émis sur cette facture : on encaisse le net, pas le brut. Même
  // enchaînement que les autres routes d'encaissement — ce que la facture
  // réclame vraiment (claimedTtc), puis déduction de ses avoirs.
  const creditNotes = (await fetchCreditNotesByInvoice(supabaseAdmin, [invoice.id])).get(invoice.id) || [];
  const creditedTtc = sumCreditNotesTtc(creditNotes);
  const effectiveTotalTtc = netDueTtc(
    { total_ttc: claimedTtc(invoice, depositsTtc) },
    creditNotes,
  );

  if (effectiveTotalTtc <= 0) {
    return NextResponse.json(
      {
        error: creditedTtc < 0
          ? 'Cette facture a été intégralement créditée par un avoir'
          : 'Cette facture ne comporte aucun montant à régler',
      },
      { status: 400 },
    );
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
