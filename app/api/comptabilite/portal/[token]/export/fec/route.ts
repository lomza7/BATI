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
    .select('id, invoice_number, title, total_ht, total_ttc, tva_rate, tva_breakdown, paid_at, issued_at, created_at, client_id, invoice_type, quote_id, clients(name)')
    .eq('user_id', access.user_id)
    .order('created_at', { ascending: true });
  if (scope.start) invoiceQuery = invoiceQuery.gte('created_at', scope.start);
  if (scope.end) invoiceQuery = invoiceQuery.lte('created_at', scope.end + 'T23:59:59');
  const { data: invoices } = await invoiceQuery;

  // Pour calculer correctement le montant effectif des factures de solde
  // (brut - acomptes déjà facturés), il faut connaître **tous** les acomptes
  // liés — y compris ceux émis avant la période fiscale exportée. On les
  // fetch sans filtre de date sur les mêmes quote_ids pour éviter de
  // surestimer le CA quand le solde est dans la période mais l'acompte en
  // dehors.
  const soldeQuoteIds = Array.from(
    new Set(
      (invoices || [])
        .filter((inv: Record<string, unknown>) => inv.invoice_type === 'solde' && inv.quote_id)
        .map((inv: Record<string, unknown>) => String(inv.quote_id)),
    ),
  );
  const depositsByQuote = new Map<string, number>();
  if (soldeQuoteIds.length > 0) {
    const { data: linkedDeposits } = await supabaseAdmin
      .from('invoices')
      .select('quote_id, total_ttc')
      .eq('user_id', access.user_id)
      .eq('invoice_type', 'acompte')
      .neq('status', 'annulee')
      .in('quote_id', soldeQuoteIds);
    for (const d of linkedDeposits || []) {
      const qid = String((d as Record<string, unknown>).quote_id);
      const amount = Number((d as Record<string, unknown>).total_ttc || 0);
      depositsByQuote.set(qid, (depositsByQuote.get(qid) || 0) + amount);
    }
  }

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

  const invoiceRows = (invoices || []).map((inv: Record<string, unknown>) => {
    const type = (inv.invoice_type as string | undefined) || 'standard';
    const qid = inv.quote_id as string | null | undefined;
    const rawHt = Number(inv.total_ht || 0);
    const rawTtc = Number(inv.total_ttc || 0);

    // Pour les factures de solde, on déduit les acomptes pour éviter le
    // double comptage du CA. Le ratio brut/net est appliqué au HT pour garder
    // une ligne FEC cohérente (HT + TVA = TTC).
    let effectiveHt = rawHt;
    let effectiveTtc = rawTtc;
    if (type === 'solde' && qid) {
      const deducted = depositsByQuote.get(String(qid)) || 0;
      effectiveTtc = Math.max(0, rawTtc - deducted);
      // Si le brut n'est pas nul, on applique le même ratio au HT pour que
      // (HT + TVA) reste égal au TTC effectif. Sinon on tombe à 0.
      effectiveHt = rawTtc > 0 ? Math.round((effectiveTtc * rawHt / rawTtc) * 100) / 100 : 0;
    }

    return {
      id: String(inv.id),
      invoice_number: String(inv.invoice_number || ''),
      title: String(inv.title || ''),
      client_name:
        Array.isArray(inv.clients)
          ? ((inv.clients[0] as Record<string, unknown>)?.name as string | null) || ''
          : ((inv.clients as Record<string, unknown>)?.name as string | null) || '',
      total_ht: effectiveHt,
      tva_rate: inv.tva_rate as number | null,
      // Pour un solde, on ne passe pas le breakdown stocké (qui correspond au
      // brut) — le builder retombera sur le taux legacy pour générer une
      // paire de lignes cohérente avec le HT effectif.
      tva_breakdown: type === 'solde' ? null : inv.tva_breakdown,
      total_ttc: effectiveTtc,
      paid_at: inv.paid_at as string | null,
      issued_at: inv.issued_at as string | null,
      created_at: String(inv.created_at),
    };
  });

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
