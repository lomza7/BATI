import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateInvoicePaySession } from '@/lib/public-access';
import {
  claimedTtc,
  fetchCreditNotesByInvoice,
  fetchDepositsNetTtc,
  isCreditNote,
  netDueTtc,
  sumCreditNotesTtc,
} from '@/lib/invoices/credit-notes';

export const runtime = 'nodejs';

/**
 * Identifiant du PaymentIntent contenu dans son client_secret
 * (`pi_xxx_secret_yyy`). Permet de relire le montant réellement porté par
 * l'intention de paiement sans stocker d'identifiant supplémentaire.
 */
function paymentIntentIdFromSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  const [id] = secret.split('_secret');
  return id && id.startsWith('pi_') ? id : null;
}

/**
 * Montant (en centimes) réellement porté par le PaymentIntent, ou `null` si
 * on ne peut pas le lire (clé Stripe absente, réseau, intention supprimée).
 * `received` renvoie ce qui a effectivement été encaissé, utile pour l'écran
 * « Paiement réussi ».
 */
async function retrieveIntentAmounts(
  clientSecret: string | null,
  stripeAccountId: string | null,
): Promise<{ amount: number; received: number } | null> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const intentId = paymentIntentIdFromSecret(clientSecret);
  if (!stripeKey || !intentId || !stripeAccountId) return null;

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });
    const intent = await stripe.paymentIntents.retrieve(
      intentId,
      {},
      { stripeAccount: stripeAccountId },
    );
    return {
      amount: typeof intent.amount === 'number' ? intent.amount : 0,
      received:
        typeof intent.amount_received === 'number' && intent.amount_received > 0
          ? intent.amount_received
          : typeof intent.amount === 'number'
            ? intent.amount
            : 0,
    };
  } catch {
    return null;
  }
}

// Politique d'accès : l'UUID v4 de la facture sert de token de paiement
// public (~122 bits d'entropie). Même principe que les liens de partage
// Google Docs / Calendly. Rien d'exploitable ne fuite sans l'UUID : le
// client_secret Stripe est public par design, et il ne permet que de
// *payer* cette facture, pas d'en détourner les fonds.
// Amélioration defense-in-depth possible (non prioritaire) : ajouter une
// colonne `public_pay_token` dédiée + double-routing pour ne pas casser
// les liens déjà envoyés. Voir audit §1.2.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  // Contrat public-access : validation AVANT toute requête DB. Voir §1.3.
  const access = await validateInvoicePaySession(params.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const data = access.data;

  // `validateInvoicePaySession` ne charge que le strict nécessaire au contrat
  // d'accès. Le montant réellement réclamé dépend en plus du type de facture
  // (une facture de solde stocke le total BRUT du devis) et des avoirs émis :
  // on complète donc la lecture ici, après validation.
  const { data: meta } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_type, quote_id')
    .eq('id', data.id)
    .maybeSingle();

  if (!meta) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  // Un avoir rembourse le client : il n'est jamais encaissable, donc aucun
  // lien de paiement ne doit l'exposer.
  if (isCreditNote(meta)) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  // Ordre canonique : on ramène d'abord la facture à ce qu'elle réclame
  // réellement (une facture de solde déduit les acomptes déjà facturés, eux
  // -mêmes nets de leurs propres avoirs), puis on retire les avoirs émis sur
  // cette facture-ci. Jamais deux fois la même déduction.
  const depositsTtc =
    meta.invoice_type === 'solde' && meta.quote_id
      ? await fetchDepositsNetTtc(supabaseAdmin, meta.quote_id)
      : 0;

  const creditNotes =
    (await fetchCreditNotesByInvoice(supabaseAdmin, [data.id])).get(data.id) || [];
  const creditedTtc = sumCreditNotesTtc(creditNotes);
  const claimed = claimedTtc(
    { total_ttc: Number(data.total_ttc), invoice_type: meta.invoice_type },
    depositsTtc,
  );
  const netDue = netDueTtc({ total_ttc: claimed }, creditNotes);
  const netDueCents = Math.round(netDue * 100);

  if (data.status === 'payee') {
    // Écran « Paiement réussi » : on annonce ce que Stripe a réellement
    // encaissé. À défaut (paiement encaissé hors HelloPay, Stripe injoignable),
    // on retombe sur le net recalculé — jamais sur le total brut.
    const intent = await retrieveIntentAmounts(
      data.payment_client_secret,
      data.payment_stripe_account_id,
    );
    return NextResponse.json({
      id: data.id,
      title: data.title,
      total_ttc: Number(data.total_ttc),
      net_due_ttc: netDue,
      paid_amount_ttc: intent ? intent.received / 100 : netDue,
      status: 'payee',
    });
  }

  if (!data.payment_client_secret || !data.payment_stripe_account_id) {
    return NextResponse.json({ error: 'Lien non initialise' }, { status: 404 });
  }

  // Facture intégralement créditée (ou sans montant) : plus rien à encaisser,
  // on ne sert pas le client_secret, sinon le client paierait un montant qu'on
  // lui a déjà crédité.
  if (netDueCents <= 0) {
    return NextResponse.json(
      {
        error: creditedTtc < 0
          ? 'Cette facture a ete integralement creditee par un avoir : plus rien n\'est a regler'
          : 'Cette facture ne comporte aucun montant a regler',
      },
      { status: 410 },
    );
  }

  // Le PaymentIntent a été créé avec le net connu à ce moment-là. Si un avoir
  // (ou un acompte) est intervenu depuis, il porte un montant périmé : on
  // invalide le lien plutôt que de débiter plus que le montant annoncé.
  const intent = await retrieveIntentAmounts(
    data.payment_client_secret,
    data.payment_stripe_account_id,
  );
  if (intent && Math.abs(intent.amount - netDueCents) > 1) {
    return NextResponse.json(
      {
        error:
          'Le montant de ce lien de paiement n\'est plus a jour. Demandez un nouveau lien a votre artisan.',
      },
      { status: 409 },
    );
  }

  // Tolérance d'un centime (arrondis de TVA) : dans ce cas on annonce le
  // montant du PaymentIntent lui-même, puisque c'est lui qui sera débité.
  const announcedTtc = intent ? intent.amount / 100 : netDue;

  return NextResponse.json({
    id: data.id,
    title: data.title,
    total_ttc: Number(data.total_ttc),
    // Seule valeur à afficher : le montant réellement réclamé, net des
    // acomptes et des avoirs, aligné sur le montant du PaymentIntent.
    net_due_ttc: announcedTtc,
    status: data.status,
    payment_client_secret: data.payment_client_secret,
    payment_stripe_account_id: data.payment_stripe_account_id,
    payment_publishable_key: data.payment_publishable_key || '',
  });
}
