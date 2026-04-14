import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select(
      'id, title, total_ttc, status, payment_client_secret, payment_stripe_account_id, payment_publishable_key',
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

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
