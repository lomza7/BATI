import { NextResponse } from 'next/server';
import Stripe from 'stripe';
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

  // Un avoir est une facture rectificative : il rembourse le client, il ne
  // s'encaisse jamais. Aucun lien de paiement ne doit pouvoir le régler.
  if (isCreditNote(invoice)) {
    return NextResponse.json(
      { error: 'Un avoir ne peut pas être réglé en ligne' },
      { status: 400 },
    );
  }

  if (invoice.status === 'payee' || invoice.status === 'annulee') {
    return NextResponse.json(
      { error: 'Cette facture est déjà payée ou annulée' },
      { status: 400 },
    );
  }

  // Pour les factures de solde : on calcule le reste à payer en déduisant les
  // acomptes liés non annulés, nets de leurs propres avoirs. C'est
  // volontairement recalculé à la lecture (pas stocké) pour rester correct si
  // un acompte est annulé ou crédité après coup.
  const depositsTtc =
    invoice.invoice_type === 'solde' && invoice.quote_id
      ? await fetchDepositsNetTtc(supabaseAdmin, invoice.quote_id)
      : 0;

  // Avoirs émis sur cette facture : on encaisse le net, jamais le brut, sinon
  // on réclame au client un montant qu'on lui a déjà crédité. `claimedTtc`
  // ramène d'abord la facture à ce qu'elle réclame réellement (cas du solde),
  // puis `netDueTtc` en retire les avoirs — jamais deux fois les mêmes.
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
