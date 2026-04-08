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
    .from('invoices')
    .select(
      `id, invoice_number, title, status, issued_at, due_date, paid_at, created_at,
       total_ht, total_ttc, tva_rate, client_id,
       clients(name)`,
    )
    .eq('user_id', access.user_id)
    .order('issued_at', { ascending: false, nullsFirst: false });

  if (scope.start) query = query.gte('created_at', scope.start);
  if (scope.end) query = query.lte('created_at', scope.end + 'T23:59:59');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invoices: data || [] });
}
