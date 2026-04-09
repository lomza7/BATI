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
    .select(
      'total_ht, total_ttc, total_tva, status, paid_at, issued_at, created_at, invoice_type, quote_id',
      { count: 'exact' },
    )
    .eq('user_id', access.user_id);
  if (scope.start) invoicesQuery = invoicesQuery.gte('created_at', scope.start);
  if (scope.end) invoicesQuery = invoicesQuery.lte('created_at', scope.end + 'T23:59:59');
  const { data: invoicesAgg, count: invoicesCount } = await invoicesQuery;

  // Pour éviter le double-comptage du CA, on charge tous les acomptes liés aux
  // factures de solde présentes dans la période (sans filtre de date : un
  // acompte peut avoir été émis avant la période). Le net = solde brut −
  // acomptes liés.
  const soldeQuoteIds = Array.from(
    new Set(
      (invoicesAgg || [])
        .filter((inv: Record<string, unknown>) => inv.invoice_type === 'solde' && inv.quote_id)
        .map((inv: Record<string, unknown>) => String(inv.quote_id)),
    ),
  );
  const depositsByQuote = new Map<string, { ht: number; ttc: number; tva: number }>();
  if (soldeQuoteIds.length > 0) {
    const { data: linkedDeposits } = await supabaseAdmin
      .from('invoices')
      .select('quote_id, total_ht, total_ttc, total_tva')
      .eq('user_id', access.user_id)
      .eq('invoice_type', 'acompte')
      .neq('status', 'annulee')
      .in('quote_id', soldeQuoteIds);
    for (const d of linkedDeposits || []) {
      const qid = String((d as Record<string, unknown>).quote_id);
      const prev = depositsByQuote.get(qid) || { ht: 0, ttc: 0, tva: 0 };
      depositsByQuote.set(qid, {
        ht: prev.ht + Number((d as Record<string, unknown>).total_ht || 0),
        ttc: prev.ttc + Number((d as Record<string, unknown>).total_ttc || 0),
        tva: prev.tva + Number((d as Record<string, unknown>).total_tva || 0),
      });
    }
  }

  let totalRevenueHt = 0;
  let totalRevenueTtc = 0;
  let totalTvaCollectee = 0;
  let paidCount = 0;
  for (const inv of invoicesAgg || []) {
    let ht = Number(inv.total_ht || 0);
    let ttc = Number(inv.total_ttc || 0);
    let tva = inv.total_tva != null ? Number(inv.total_tva) : Math.max(0, ttc - ht);
    if (inv.invoice_type === 'solde' && inv.quote_id) {
      const d = depositsByQuote.get(String(inv.quote_id));
      if (d) {
        ht = Math.max(0, ht - d.ht);
        ttc = Math.max(0, ttc - d.ttc);
        tva = Math.max(0, tva - d.tva);
      }
    }
    totalRevenueHt += ht;
    totalRevenueTtc += ttc;
    totalTvaCollectee += tva;
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
