import { NextResponse } from 'next/server';
import { validateInvoicePaySession } from '@/lib/public-access';

export const runtime = 'nodejs';

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

  if (data.status === 'payee') {
    return NextResponse.json({
      id: data.id,
      title: data.title,
      total_ttc: Number(data.total_ttc),
      status: 'payee',
    });
  }

  if (!data.payment_client_secret || !data.payment_stripe_account_id) {
    return NextResponse.json({ error: 'Lien non initialise' }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    title: data.title,
    total_ttc: Number(data.total_ttc),
    status: data.status,
    payment_client_secret: data.payment_client_secret,
    payment_stripe_account_id: data.payment_stripe_account_id,
    payment_publishable_key: data.payment_publishable_key || '',
  });
}
