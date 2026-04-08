import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateToken } from '@/lib/comptabilite/accountant-scope';

export const runtime = 'nodejs';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const validation = await validateToken(params.token);
  if (!validation.ok || !validation.access) {
    return NextResponse.json({ error: validation.error || 'Lien invalide' }, { status: validation.status });
  }
  const access = validation.access;
  const scope = validation.scope!;

  let q = supabaseAdmin
    .from('expenses')
    .select('id, date, supplier, amount, receipt_storage_path')
    .eq('user_id', access.user_id)
    .not('receipt_storage_path', 'is', null)
    .order('date', { ascending: false });

  if (scope.start) q = q.gte('date', scope.start);
  if (scope.end) q = q.lte('date', scope.end);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items: { expense_id: string; date: string; supplier: string; amount: number | null; path: string; signed_url: string | null }[] = [];

  for (const row of data || []) {
    const path = row.receipt_storage_path as string | null;
    if (!path) continue;
    let signedUrl: string | null = null;
    try {
      const { data: signed } = await supabaseAdmin.storage
        .from('receipts')
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      signedUrl = signed?.signedUrl || null;
    } catch {
      signedUrl = null;
    }
    items.push({
      expense_id: row.id as string,
      date: row.date as string,
      supplier: (row.supplier as string) || '',
      amount: row.amount as number | null,
      path,
      signed_url: signedUrl,
    });
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    expires_in_seconds: SIGNED_URL_TTL_SECONDS,
    count: items.length,
    receipts: items,
  });
}
