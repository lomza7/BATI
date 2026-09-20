import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { trackTokenView, validateToken } from '@/lib/comptabilite/accountant-scope';
import {
  fetchCreditNotesByInvoice,
  isIssuedCreditNote,
  sumCreditNotesHt,
  sumCreditNotesTtc,
  type CreditNoteRef,
} from '@/lib/invoices/credit-notes';

export const runtime = 'nodejs';

/** Arrondi comptable à 2 décimales — évite les résidus flottants dans le JSON. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pendant TVA de `sumCreditNotesTtc` : somme de la TVA des avoirs **émis**,
 * donc négative ou nulle. Helper local — le module partagé n'expose pas
 * d'équivalent et plusieurs chantiers y travaillent en parallèle.
 */
function sumCreditNotesTva(notes: CreditNoteRef[]): number {
  return round2(
    notes.filter(isIssuedCreditNote).reduce((sum, n) => {
      const ttc = Number(n.total_ttc || 0);
      const ht = Number(n.total_ht || 0);
      // Fallback symétrique du cas facture : sur un avoir, (TTC − HT) est
      // négatif, le borner à 0 effacerait la TVA à régulariser.
      const tva = n.total_tva ? Number(n.total_tva) : Math.min(0, ttc - ht);
      return sum + tva;
    }, 0),
  );
}

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
  // Les avoirs sont exclus d'ici et agrégés séparément plus bas : ce sont des
  // factures rectificatives, les compter dans « N factures » gonflerait le
  // volume déclaré alors qu'ils viennent en déduction.
  let invoicesQuery = supabaseAdmin
    .from('invoices')
    .select(
      'total_ht, total_ttc, total_tva, status, paid_at, issued_at, created_at, invoice_type, quote_id',
      { count: 'exact' },
    )
    .eq('user_id', access.user_id)
    .neq('invoice_type', 'avoir');
  if (scope.start) invoicesQuery = invoicesQuery.gte('created_at', scope.start);
  if (scope.end) invoicesQuery = invoicesQuery.lte('created_at', scope.end + 'T23:59:59');
  const { data: invoicesAgg, count: invoicesCount } = await invoicesQuery;

  // Aggregates: avoirs (factures rectificatives, art. 289 CGI).
  // Leurs montants sont stockés en négatif : ils viennent donc en déduction du
  // CA et de la TVA collectée par simple addition. On les rattache à la période
  // où ils ont été émis, pas à celle de la facture rectifiée — c'est la règle
  // de rattachement comptable, et c'est la période sur laquelle l'artisan
  // récupère sa TVA (art. 272-1 CGI).
  let creditNotesQuery = supabaseAdmin
    .from('invoices')
    .select('total_ht, total_ttc, total_tva, status, credited_invoice_id, created_at')
    .eq('user_id', access.user_id)
    .eq('invoice_type', 'avoir');
  if (scope.start) creditNotesQuery = creditNotesQuery.gte('created_at', scope.start);
  if (scope.end) creditNotesQuery = creditNotesQuery.lte('created_at', scope.end + 'T23:59:59');
  const { data: creditNotesAgg } = await creditNotesQuery;

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
      .select('id, quote_id, total_ht, total_ttc, total_tva')
      .eq('user_id', access.user_id)
      .eq('invoice_type', 'acompte')
      .neq('status', 'annulee')
      .in('quote_id', soldeQuoteIds);
    const depositRows = (linkedDeposits || []) as Record<string, unknown>[];
    // Un acompte crédité par un avoir est déjà déduit du CA plus bas, par
    // l'addition de l'avoir (montants négatifs). Le retrancher en BRUT du solde
    // amputerait donc deux fois le chiffre d'affaires et la TVA collectée
    // remis au comptable : on ne déduit que le montant NET de chaque acompte.
    const notesByDeposit = await fetchCreditNotesByInvoice(
      supabaseAdmin,
      depositRows.map((d) => String(d.id)),
    );
    for (const d of depositRows) {
      const qid = String(d.quote_id);
      const notes = notesByDeposit.get(String(d.id)) || [];
      const grossHt = Number(d.total_ht || 0);
      const grossTtc = Number(d.total_ttc || 0);
      const grossTva = d.total_tva != null ? Number(d.total_tva) : Math.max(0, grossTtc - grossHt);
      const prev = depositsByQuote.get(qid) || { ht: 0, ttc: 0, tva: 0 };
      depositsByQuote.set(qid, {
        ht: prev.ht + Math.max(0, grossHt + sumCreditNotesHt(notes)),
        ttc: prev.ttc + Math.max(0, grossTtc + sumCreditNotesTtc(notes)),
        tva: prev.tva + Math.max(0, grossTva + sumCreditNotesTva(notes)),
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
        // Bornes légitimes ici : un solde net d'acomptes ne peut pas être
        // négatif, les acomptes ne dépassent jamais le montant du devis.
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

  // Déduction des avoirs. Montants négatifs : on additionne, on ne soustrait
  // pas, et on ne borne surtout pas à 0. Une TVA collectée nette négative est
  // légitime — l'artisan a alors un crédit de TVA qu'il reporte ou se fait
  // rembourser ; l'écraser à 0 lui ferait perdre ce crédit.
  let totalCreditNotesHt = 0;
  let totalCreditNotesTtc = 0;
  let totalCreditNotesTva = 0;
  let issuedCreditNotesCount = 0;
  for (const note of creditNotesAgg || []) {
    // Un avoir en brouillon n'est pas émis : il ne régularise rien.
    if (!isIssuedCreditNote({ status: note.status as string | null })) continue;
    const ht = Number(note.total_ht || 0);
    const ttc = Number(note.total_ttc || 0);
    // Fallback symétrique du cas facture : sur un avoir, (TTC − HT) est
    // négatif, le borner à 0 effacerait la TVA à régulariser.
    const tva = note.total_tva != null ? Number(note.total_tva) : Math.min(0, ttc - ht);
    totalCreditNotesHt += ht;
    totalCreditNotesTtc += ttc;
    totalCreditNotesTva += tva;
    issuedCreditNotesCount += 1;
  }

  totalRevenueHt += totalCreditNotesHt;
  totalRevenueTtc += totalCreditNotesTtc;
  totalTvaCollectee += totalCreditNotesTva;

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
      // Nombre d'avoirs émis sur la période, et leurs montants — négatifs.
      credit_notes_count: issuedCreditNotesCount,
      total_credit_notes_ht: round2(totalCreditNotesHt),
      total_credit_notes_ttc: round2(totalCreditNotesTtc),
      total_credit_notes_tva: round2(totalCreditNotesTva),
      total_expenses_ht: round2(totalExpensesHt),
      total_expenses_ttc: round2(totalExpensesTtc),
      // CA et TVA collectée : nets des avoirs émis sur la période.
      total_revenue_ht: round2(totalRevenueHt),
      total_revenue_ttc: round2(totalRevenueTtc),
      total_tva_collectee: round2(totalTvaCollectee),
      total_tva_deductible: round2(totalTvaDeductible),
      tva_balance: round2(totalTvaCollectee - totalTvaDeductible),
      result_estimated: round2(totalRevenueHt - totalExpensesHt),
    },
  });
}
