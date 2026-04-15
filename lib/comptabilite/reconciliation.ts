// Moteur de rapprochement bancaire automatique
//
// Stratégie : pour chaque transaction non rapprochée, on cherche
//   - Débit (sortie de compte) → une dépense avec montant TTC == |amount| et date proche
//   - Crédit (entrée) → une facture payée avec total_ttc == amount et date proche
//
// Si un seul candidat correspond, on l'attribue automatiquement (confidence = 1.0).
// Sinon on laisse la transaction orpheline pour la passe IA ou le traitement manuel.

import type { SupabaseClient } from '@supabase/supabase-js';

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

  // Factures non encore liées
  const { data: invData, error: invErr } = await sb
    .from('invoices')
    .select('id, total_ttc, paid_at, issued_at, due_date, status, bank_transaction_id')
    .eq('user_id', userId)
    .is('bank_transaction_id', null);
  if (invErr) throw invErr;
  const invoices = (invData || []) as InvoiceRow[];

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
        if (Math.abs(Number(i.total_ttc) - target) >= 0.01) return false;
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

  // Si c'est une facture rapprochée à une transaction "credit", on la marque payée
  if (kind === 'invoice') {
    const { data: inv } = await sb
      .from('invoices')
      .select('paid_at, status')
      .eq('id', targetId)
      .maybeSingle();
    if (inv && !inv.paid_at) {
      const { data: tx } = await sb
        .from('bank_transactions')
        .select('transaction_date')
        .eq('id', bankTransactionId)
        .maybeSingle();
      if (tx?.transaction_date) {
        await sb
          .from('invoices')
          .update({ paid_at: tx.transaction_date, status: 'payee' })
          .eq('id', targetId);
      }
    }
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
