// Moteur de rapprochement bancaire automatique
//
// Stratégie : pour chaque transaction non rapprochée, on cherche
//   - Débit (sortie de compte) → une dépense avec montant TTC == |amount| et date proche
//   - Crédit (entrée) → une facture dont le montant brut OU le net d'avoirs
//     == amount, et dont la date est proche
//
// Si un seul candidat correspond, on l'attribue automatiquement (confidence = 1.0).
// Sinon on laisse la transaction orpheline pour la passe IA ou le traitement manuel.
//
// Les avoirs sont hors jeu de bout en bout : ils remboursent le client, ne
// s'encaissent pas, et les rapprocher les passerait à « payée » (cf.
// lib/invoices/credit-notes.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchCreditNotesByInvoice, isCreditNote, netDueTtc } from '@/lib/invoices/credit-notes';

const DATE_WINDOW_DEBIT_DAYS = 7; // dépense saisie peut précéder/suivre le débit bancaire
const DATE_WINDOW_CREDIT_DAYS = 7; // idem pour les paiements de factures

export interface AutoMatchStats {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
}

interface BankTxRow {
  id: string;
  user_id: string;
  transaction_date: string;
  amount: number;
  direction: 'credit' | 'debit';
  matched_at: string | null;
  ignored: boolean;
}

interface ExpenseRow {
  id: string;
  amount: number | null;
  date: string;
  bank_transaction_id: string | null;
}

interface InvoiceRow {
  id: string;
  total_ttc: number | null;
  paid_at: string | null;
  issued_at: string | null;
  due_date: string | null;
  status: string | null;
  invoice_type: string | null;
  bank_transaction_id: string | null;
}

export async function autoMatchTransactions(
  sb: SupabaseClient,
  userId: string,
  statementId?: string,
): Promise<AutoMatchStats> {
  // Charge les transactions à matcher
  let txQuery = sb
    .from('bank_transactions')
    .select('id, user_id, transaction_date, amount, direction, matched_at, ignored')
    .eq('user_id', userId)
    .is('matched_at', null)
    .eq('ignored', false);

  if (statementId) {
    txQuery = txQuery.eq('statement_id', statementId);
  }

  const { data: txs, error: txErr } = await txQuery;
  if (txErr) throw txErr;
  const transactions = (txs || []) as BankTxRow[];

  if (transactions.length === 0) {
    return { total: 0, matched: 0, ambiguous: 0, unmatched: 0 };
  }

  // Calcule la fenêtre globale pour requêter expenses/invoices d'un coup
  const dates = transactions.map((t) => t.transaction_date).sort();
  const minDate = shiftDate(dates[0], -Math.max(DATE_WINDOW_DEBIT_DAYS, DATE_WINDOW_CREDIT_DAYS));
  const maxDate = shiftDate(dates[dates.length - 1], Math.max(DATE_WINDOW_DEBIT_DAYS, DATE_WINDOW_CREDIT_DAYS));

  // Pré-charge les candidats : dépenses non encore liées
  const { data: expData, error: expErr } = await sb
    .from('expenses')
    .select('id, amount, date, bank_transaction_id')
    .eq('user_id', userId)
    .is('bank_transaction_id', null)
    .gte('date', minDate)
    .lte('date', maxDate);
  if (expErr) throw expErr;
  const expenses = (expData || []) as ExpenseRow[];

  // Factures non encore liées. Les avoirs sont écartés : leur montant est
  // négatif et aucune entrée bancaire ne leur correspond.
  const { data: invData, error: invErr } = await sb
    .from('invoices')
    .select('id, total_ttc, paid_at, issued_at, due_date, status, invoice_type, bank_transaction_id')
    .eq('user_id', userId)
    .is('bank_transaction_id', null);
  if (invErr) throw invErr;
  const invoices = ((invData || []) as InvoiceRow[]).filter((i) => !isCreditNote(i));

  // Avoirs émis sur ces factures : une facture créditée avant paiement est
  // réglée pour son net, c'est ce montant-là qui apparaît alors sur le relevé
  // — sans faire disparaître le brut, qui reste valable si l'avoir a suivi le
  // virement.
  const creditNotesByInvoice = await fetchCreditNotesByInvoice(
    sb,
    invoices.map((i) => i.id),
  );

  let matched = 0;
  let ambiguous = 0;
  let unmatched = 0;

  // Set pour éviter de matcher deux transactions sur la même cible
  const usedExpenseIds = new Set<string>();
  const usedInvoiceIds = new Set<string>();

  for (const tx of transactions) {
    if (tx.direction === 'debit') {
      const target = Math.abs(tx.amount);
      const candidates = expenses.filter(
        (e) =>
          !usedExpenseIds.has(e.id) &&
          e.amount != null &&
          Math.abs(Number(e.amount) - target) < 0.01 &&
          dateWithinDays(e.date, tx.transaction_date, DATE_WINDOW_DEBIT_DAYS),
      );

      if (candidates.length === 1) {
        const exp = candidates[0];
        await applyMatch(sb, tx.id, 'expense', exp.id);
        usedExpenseIds.add(exp.id);
        matched += 1;
      } else if (candidates.length > 1) {
        ambiguous += 1;
      } else {
        unmatched += 1;
      }
    } else {
      const target = tx.amount;
      const candidates = invoices.filter((i) => {
        if (usedInvoiceIds.has(i.id)) return false;
        if (i.total_ttc == null) return false;
        // Deux montants sont acceptables sur le relevé :
        //  - le net d'avoirs, quand le client règle une facture déjà créditée ;
        //  - le brut, quand le virement a eu lieu AVANT l'émission de l'avoir
        //    (facture réglée en totalité, puis remboursement séparé).
        // Ne chercher que le net perdrait ce second cas, pourtant le plus
        // fréquent : un avoir se constate presque toujours après coup.
        const gross = Number(i.total_ttc);
        const net = netDueTtc(i, creditNotesByInvoice.get(i.id) || []);
        const amountMatches =
          (net > 0 && Math.abs(net - target) < 0.01) ||
          (gross > 0 && Math.abs(gross - target) < 0.01);
        if (!amountMatches) return false;
        const refDate = i.paid_at || i.issued_at || i.due_date;
        if (!refDate) return true;
        return dateWithinDays(refDate.slice(0, 10), tx.transaction_date, DATE_WINDOW_CREDIT_DAYS);
      });

      if (candidates.length === 1) {
        const inv = candidates[0];
        await applyMatch(sb, tx.id, 'invoice', inv.id);
        usedInvoiceIds.add(inv.id);
        matched += 1;
      } else if (candidates.length > 1) {
        ambiguous += 1;
      } else {
        unmatched += 1;
      }
    }
  }

  return { total: transactions.length, matched, ambiguous, unmatched };
}

export async function applyMatch(
  sb: SupabaseClient,
  bankTransactionId: string,
  kind: 'expense' | 'invoice',
  targetId: string,
  method: 'auto' | 'ai' | 'manual' = 'auto',
  confidence: number = 1.0,
): Promise<void> {
  // Garde avoirs + contrôle de direction : on lit la cible et la transaction
  // AVANT toute écriture, pour refuser un rapprochement interdit sans avoir
  // laissé de lien à moitié posé derrière soi.
  let invoice: Pick<InvoiceRow, 'paid_at' | 'status' | 'invoice_type'> | null = null;
  let txDirection: string | null = null;
  let txDate: string | null = null;

  if (kind === 'invoice') {
    const { data: invRow } = await sb
      .from('invoices')
      .select('paid_at, status, invoice_type')
      .eq('id', targetId)
      .maybeSingle();
    invoice = (invRow as Pick<InvoiceRow, 'paid_at' | 'status' | 'invoice_type'> | null) || null;

    if (isCreditNote(invoice)) {
      throw new Error("Un avoir ne peut pas être rapproché d'une transaction bancaire");
    }

    const { data: txRow } = await sb
      .from('bank_transactions')
      .select('direction, transaction_date')
      .eq('id', bankTransactionId)
      .maybeSingle();
    txDirection = (txRow?.direction as string | null) ?? null;
    txDate = (txRow?.transaction_date as string | null) ?? null;
  }

  const update: Record<string, unknown> = {
    matched_at: new Date().toISOString(),
    matched_kind: kind,
    match_method: method,
    match_confidence: confidence,
  };
  if (kind === 'expense') update.matched_expense_id = targetId;
  else update.matched_invoice_id = targetId;

  const { error: txErr } = await sb
    .from('bank_transactions')
    .update(update)
    .eq('id', bankTransactionId);
  if (txErr) throw txErr;

  // Lien réciproque
  const { error: linkErr } = await sb
    .from(kind === 'expense' ? 'expenses' : 'invoices')
    .update({ bank_transaction_id: bankTransactionId })
    .eq('id', targetId);
  if (linkErr) throw linkErr;

  // Si c'est une facture rapprochée à une transaction "credit", on la marque
  // payée. Un débit (sortie de compte) ne solde jamais une facture : ce serait
  // un remboursement, qui passe par un avoir et non par ce chemin.
  if (
    kind === 'invoice' &&
    invoice &&
    !invoice.paid_at &&
    invoice.status !== 'annulee' &&
    txDirection === 'credit' &&
    txDate
  ) {
    await sb
      .from('invoices')
      .update({ paid_at: txDate, status: 'payee' })
      .eq('id', targetId);
  }
}

export async function clearMatch(
  sb: SupabaseClient,
  bankTransactionId: string,
): Promise<void> {
  const { data: tx } = await sb
    .from('bank_transactions')
    .select('matched_kind, matched_expense_id, matched_invoice_id')
    .eq('id', bankTransactionId)
    .maybeSingle();

  if (tx?.matched_kind === 'expense' && tx.matched_expense_id) {
    await sb
      .from('expenses')
      .update({ bank_transaction_id: null })
      .eq('id', tx.matched_expense_id);
  }
  if (tx?.matched_kind === 'invoice' && tx.matched_invoice_id) {
    await sb
      .from('invoices')
      .update({ bank_transaction_id: null })
      .eq('id', tx.matched_invoice_id);
  }

  await sb
    .from('bank_transactions')
    .update({
      matched_at: null,
      matched_kind: null,
      matched_expense_id: null,
      matched_invoice_id: null,
      match_method: null,
      match_confidence: null,
    })
    .eq('id', bankTransactionId);
}

// ───────────────────────── Helpers ─────────────────────────

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateWithinDays(a: string, b: string, days: number): boolean {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  const diff = Math.abs(da - db) / (1000 * 60 * 60 * 24);
  return diff <= days;
}
