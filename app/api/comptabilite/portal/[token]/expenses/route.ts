import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateToken } from '@/lib/comptabilite/accountant-scope';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const validation = await validateToken(params.token);
  if (!validation.ok || !validation.access) {
    return NextResponse.json({ error: validation.error || 'Lien invalide' }, { status: validation.status });
  }
  const access = validation.access;
  const scope = validation.scope!;

  let query = supabaseAdmin
    .from('expenses')
    .select(
      `id, date, description, supplier, amount_ht, tva_rate, tva_amount, amount,
       is_autoliquidation, payment_method, source, receipt_storage_path,
       expense_categories(slug, name)`,
    )
    .eq('user_id', access.user_id)
    .order('date', { ascending: false });

  if (scope.start) query = query.gte('date', scope.start);
  if (scope.end) query = query.lte('date', scope.end);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expenses: data || [] });
}
