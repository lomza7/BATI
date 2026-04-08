import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateToken } from '@/lib/comptabilite/accountant-scope';
import { buildFecFile, fecFileName } from '@/lib/comptabilite/fec-export';

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
    .select('company_name, full_name, siret')
    .eq('id', access.user_id)
    .maybeSingle();

  let expenseQuery = supabaseAdmin
    .from('expenses')
    .select(
      `id, date, description, supplier, amount_ht, tva_amount, amount, tva_rate,
       expense_categories(slug)`,
    )
    .eq('user_id', access.user_id)
    .order('date', { ascending: true });
  if (scope.start) expenseQuery = expenseQuery.gte('date', scope.start);
  if (scope.end) expenseQuery = expenseQuery.lte('date', scope.end);
  const { data: expenses } = await expenseQuery;

  let invoiceQuery = supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, title, total_ht, total_ttc, tva_rate, paid_at, issued_at, created_at, client_id, clients(name)')
    .eq('user_id', access.user_id)
    .order('created_at', { ascending: true });
  if (scope.start) invoiceQuery = invoiceQuery.gte('created_at', scope.start);
  if (scope.end) invoiceQuery = invoiceQuery.lte('created_at', scope.end + 'T23:59:59');
  const { data: invoices } = await invoiceQuery;

  const fiscalYear = scope.start ? new Date(scope.start).getFullYear() : new Date().getFullYear();
  const fiscalYearEnd = scope.end || `${fiscalYear}-12-31`;
  const artisanName = profile?.company_name || profile?.full_name || 'Hellobat';

  const expenseRows = (expenses || []).map((e: Record<string, unknown>) => ({
    id: String(e.id),
    date: String(e.date),
    description: String(e.description || ''),
    supplier: String(e.supplier || ''),
    amount_ht: e.amount_ht as number | null,
    tva_amount: e.tva_amount as number | null,
    amount: e.amount as number | null,
    tva_rate: e.tva_rate as number | null,
    category_slug:
      Array.isArray(e.expense_categories)
        ? ((e.expense_categories[0] as Record<string, unknown>)?.slug as string | null) || null
        : ((e.expense_categories as Record<string, unknown>)?.slug as string | null) || null,
  }));

  const invoiceRows = (invoices || []).map((inv: Record<string, unknown>) => ({
    id: String(inv.id),
    invoice_number: String(inv.invoice_number || ''),
    title: String(inv.title || ''),
    client_name:
      Array.isArray(inv.clients)
        ? ((inv.clients[0] as Record<string, unknown>)?.name as string | null) || ''
        : ((inv.clients as Record<string, unknown>)?.name as string | null) || '',
    total_ht: inv.total_ht as number | null,
    tva_rate: inv.tva_rate as number | null,
    total_ttc: inv.total_ttc as number | null,
    paid_at: inv.paid_at as string | null,
    issued_at: inv.issued_at as string | null,
    created_at: String(inv.created_at),
  }));

  const fec = buildFecFile({
    artisanName,
    expenses: expenseRows,
    invoices: invoiceRows,
    fiscalYear,
  });

  const filename = fecFileName(profile?.siret || null, fiscalYearEnd);

  return new NextResponse(fec, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
