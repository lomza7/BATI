import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { trackTokenView, validateToken } from '@/lib/comptabilite/accountant-scope';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const validation = await validateToken(params.token);
  if (!validation.ok || !validation.access) {
    return NextResponse.json({ error: validation.error || 'Lien invalide' }, { status: validation.status });
  }
  const access = validation.access;
  const scope = validation.scope!;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('company_name, full_name, email, siret')
    .eq('id', access.user_id)
    .maybeSingle();

  // Aggregates: expenses
  let expensesQuery = supabaseAdmin
    .from('expenses')
    .select('amount_ht, tva_amount, amount, is_autoliquidation, date', { count: 'exact' })
    .eq('user_id', access.user_id);
  if (scope.start) expensesQuery = expensesQuery.gte('date', scope.start);
  if (scope.end) expensesQuery = expensesQuery.lte('date', scope.end);
  const { data: expensesAgg, count: expensesCount } = await expensesQuery;

  let totalExpensesHt = 0;
  let totalExpensesTtc = 0;
  let totalTvaDeductible = 0;
  for (const e of expensesAgg || []) {
    totalExpensesHt += Number(e.amount_ht || 0);
    totalExpensesTtc += Number(e.amount || 0);
    if (!e.is_autoliquidation) totalTvaDeductible += Number(e.tva_amount || 0);
  }

  // Aggregates: invoices
  let invoicesQuery = supabaseAdmin
    .from('invoices')
    .select('total_ht, total_ttc, total_tva, status, paid_at, issued_at, created_at', { count: 'exact' })
    .eq('user_id', access.user_id);
  if (scope.start) invoicesQuery = invoicesQuery.gte('created_at', scope.start);
  if (scope.end) invoicesQuery = invoicesQuery.lte('created_at', scope.end + 'T23:59:59');
  const { data: invoicesAgg, count: invoicesCount } = await invoicesQuery;

  let totalRevenueHt = 0;
  let totalRevenueTtc = 0;
  let totalTvaCollectee = 0;
  let paidCount = 0;
  for (const inv of invoicesAgg || []) {
    const ht = Number(inv.total_ht || 0);
    const ttc = Number(inv.total_ttc || 0);
    totalRevenueHt += ht;
    totalRevenueTtc += ttc;
    // Prefer stored total_tva (per-rate aware) when available, fallback to ttc - ht
    totalTvaCollectee +=
      inv.total_tva != null ? Number(inv.total_tva) : Math.max(0, ttc - ht);
    if (inv.status === 'paid' || inv.paid_at) paidCount += 1;
  }

  await trackTokenView(access.id);

  return NextResponse.json({
    artisan: {
      company_name: profile?.company_name || '',
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      siret: profile?.siret || '',
    },
    access: {
      id: access.id,
      accountant_email: access.accountant_email,
      accountant_name: access.accountant_name,
      scope: access.scope,
      scope_label: scope.label,
      scope_start: scope.start,
      scope_end: scope.end,
      expires_at: access.expires_at,
      view_count: access.view_count + 1,
    },
    summary: {
      expenses_count: expensesCount || 0,
      invoices_count: invoicesCount || 0,
      paid_invoices_count: paidCount,
      total_expenses_ht: totalExpensesHt,
      total_expenses_ttc: totalExpensesTtc,
      total_revenue_ht: totalRevenueHt,
      total_revenue_ttc: totalRevenueTtc,
      total_tva_collectee: totalTvaCollectee,
      total_tva_deductible: totalTvaDeductible,
      tva_balance: totalTvaCollectee - totalTvaDeductible,
      result_estimated: totalRevenueHt - totalExpensesHt,
    },
  });
}
