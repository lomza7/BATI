/**
 * Factures d'acompte — helpers métier.
 *
 * Conformité BTP française : un artisan qui fait signer un devis facture
 * presque toujours en plusieurs temps — un acompte à la signature (souvent
 * 30 %), parfois une situation à mi-chantier, puis une facture de solde
 * qui déduit les acomptes déjà versés.
 *
 * Chaque acompte est **légalement** une facture à part entière (loi
 * anti-fraude TVA 2018, art. 289 CGI) avec son propre numéro dans la
 * séquence F-YYYY-NNN unique. Ce fichier centralise :
 *  - le calcul "déjà facturé / reste à facturer" sur un devis,
 *  - le calcul du montant d'un acompte (en % ou en montant HT),
 *  - le calcul du CA effectif d'une facture (pour éviter le doublon solde +
 *    acomptes dans les KPIs dashboard et l'export FEC).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type InvoiceType = 'standard' | 'acompte' | 'solde';

export interface DepositInvoice {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  deposit_percentage: number | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  status: string;
  paid_at: string | null;
  issued_at: string | null;
  created_at: string;
  quote_id?: string | null;
}

export interface QuoteBillingSummary {
  /** Total TTC du devis */
  quoteTotalTtc: number;
  /** Total HT du devis */
  quoteTotalHt: number;
  /** Toutes les factures liées au devis (acomptes + solde + standard si existant), triées par date */
  invoices: DepositInvoice[];
  /** Somme TTC de toutes les factures non annulées liées (brouillon + envoyée + payée) */
  invoicedTtc: number;
  /** Somme TTC des factures réellement encaissées (status = payee) */
  collectedTtc: number;
  /**
   * Reste à facturer TTC.
   * S'il existe une facture de solde ou une facture standard, tout est considéré facturé (= 0).
   * Sinon on soustrait les acomptes déjà créés du total du devis.
   */
  remainingTtc: number;
  /** Reste à encaisser = quoteTotalTtc - collectedTtc (borné à 0) */
  outstandingTtc: number;
  /** Existe-t-il déjà une facture de solde pour ce devis ? */
  hasFinalInvoice: boolean;
  /** Existe-t-il déjà une facture standard (flow direct "facturer en totalité") ? */
  hasStandardInvoice: boolean;
}

/**
 * Arrondi à 2 décimales — même règle que lib/tva.ts pour rester cohérent
 * entre les différents calculs.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Récupère toutes les factures liées à un devis et calcule le résumé
 * de facturation. Exclut les factures annulées (status = 'annulee').
 *
 * Utilisé par la carte "Facturation" sur la page devis, les dialogs de
 * création d'acompte / solde, et les garde-fous côté UI.
 */
export async function fetchQuoteBilling(
  supabase: SupabaseClient,
  quoteId: string,
  quoteTotalHt: number,
  quoteTotalTtc: number,
): Promise<QuoteBillingSummary> {
  const { data } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, invoice_type, deposit_percentage, total_ht, total_tva, total_ttc, status, paid_at, issued_at, created_at, quote_id',
    )
    .eq('quote_id', quoteId)
    .neq('status', 'annulee')
    .order('issued_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  const invoices = ((data as DepositInvoice[] | null) || []).map((row) => ({
    ...row,
    total_ht: Number(row.total_ht) || 0,
    total_tva: Number(row.total_tva) || 0,
    total_ttc: Number(row.total_ttc) || 0,
    deposit_percentage:
      row.deposit_percentage === null || row.deposit_percentage === undefined
        ? null
        : Number(row.deposit_percentage),
  }));

  const hasFinalInvoice = invoices.some((i) => i.invoice_type === 'solde');
  const hasStandardInvoice = invoices.some((i) => i.invoice_type === 'standard');

  // Pour le "déjà facturé", on additionne uniquement les acomptes :
  //  - s'il n'y a pas encore de solde, ça donne la vraie progression
  //  - s'il y a un solde, on veut afficher "tout facturé" → on force remaining = 0
  // La facture standard n'entre pas dans les acomptes mais couvre 100 % du devis.
  const invoicedFromDeposits = invoices
    .filter((i) => i.invoice_type === 'acompte')
    .reduce((sum, i) => sum + i.total_ttc, 0);

  const invoicedTtc =
    hasFinalInvoice || hasStandardInvoice ? quoteTotalTtc : round2(invoicedFromDeposits);

  const collectedTtc = round2(
    invoices.filter((i) => i.status === 'payee').reduce((sum, i) => sum + i.total_ttc, 0),
  );

  const remainingTtc = Math.max(0, round2(quoteTotalTtc - invoicedTtc));
  const outstandingTtc = Math.max(0, round2(quoteTotalTtc - collectedTtc));

  return {
    quoteTotalTtc,
    quoteTotalHt,
    invoices,
    invoicedTtc,
    collectedTtc,
    remainingTtc,
    outstandingTtc,
    hasFinalInvoice,
    hasStandardInvoice,
  };
}

export interface DepositAmount {
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  /** Pourcentage correspondant au montant (arrondi à 2 décimales). Null si quoteTotalHt = 0. */
  percentage: number | null;
}

/**
 * Calcule les montants HT / TVA / TTC d'un acompte à partir :
 *  - soit d'un pourcentage du total HT du devis,
 *  - soit d'un montant HT saisi directement.
 *
 * Le taux de TVA utilisé est `primaryTvaRate` = taux majoritaire du devis
 * (voir lib/tva.ts::computeTvaBreakdown.primary_rate). Les rares devis
 * multi-taux auront un acompte mono-taux — c'est une simplification
 * acceptable pour le MVP, et l'écart se résorbe sur la facture de solde
 * qui reprend les lignes exactes du devis.
 */
export function computeDepositAmount(
  mode: 'percentage' | 'amount_ht',
  value: number,
  quoteTotalHt: number,
  primaryTvaRate: number,
): DepositAmount {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  const safeQuoteHt = Number.isFinite(quoteTotalHt) && quoteTotalHt > 0 ? quoteTotalHt : 0;
  const safeRate = Number.isFinite(primaryTvaRate) && primaryTvaRate >= 0 ? primaryTvaRate : 20;

  let total_ht: number;
  let percentage: number | null;

  if (mode === 'percentage') {
    const clampedPct = Math.min(100, safeValue);
    percentage = clampedPct;
    total_ht = round2((safeQuoteHt * clampedPct) / 100);
  } else {
    total_ht = round2(safeValue);
    percentage = safeQuoteHt > 0 ? round2((total_ht / safeQuoteHt) * 100) : null;
  }

  const total_tva = round2((total_ht * safeRate) / 100);
  const total_ttc = round2(total_ht + total_tva);

  return { total_ht, total_tva, total_ttc, percentage };
}

/**
 * CA effectif d'une facture — utilisé pour le dashboard et le FEC pour
 * éviter le doublon "acomptes + facture de solde brute".
 *
 * La facture de solde stocke en DB le **total brut du devis** (pas le
 * reste à payer) pour que la déduction des acomptes reste cohérente si
 * un acompte est annulé après coup. Conséquence : lors de l'agrégation
 * du CA, il faut déduire du solde la somme des acomptes liés, sinon on
 * compte ces montants 2 × (une fois en acompte, une fois en solde).
 *
 * Règle :
 *  - type 'standard' ou 'acompte' → total_ttc brut
 *  - type 'solde' → total_ttc − Σ(acomptes liés non annulés)
 */
export function computeEffectiveTotal(
  invoice: Pick<DepositInvoice, 'invoice_type' | 'total_ttc'>,
  relatedDeposits: Array<Pick<DepositInvoice, 'total_ttc' | 'status'>>,
): number {
  const base = Number(invoice.total_ttc) || 0;
  if (invoice.invoice_type !== 'solde') return round2(base);
  const deductions = relatedDeposits
    .filter((d) => d.status !== 'annulee')
    .reduce((sum, d) => sum + (Number(d.total_ttc) || 0), 0);
  return Math.max(0, round2(base - deductions));
}

/**
 * Même logique pour le HT (utilisé par le FEC) — on déduit au prorata
 * des acomptes en se basant sur leur propre total HT (qui est déjà
 * calculé avec le même primary_rate).
 */
export function computeEffectiveTotalHt(
  invoice: Pick<DepositInvoice, 'invoice_type' | 'total_ht'>,
  relatedDeposits: Array<Pick<DepositInvoice, 'total_ht' | 'status'>>,
): number {
  const base = Number(invoice.total_ht) || 0;
  if (invoice.invoice_type !== 'solde') return round2(base);
  const deductions = relatedDeposits
    .filter((d) => d.status !== 'annulee')
    .reduce((sum, d) => sum + (Number(d.total_ht) || 0), 0);
  return Math.max(0, round2(base - deductions));
}

/**
 * Libellé humain pour un type de facture, utilisé dans les badges et
 * l'email transactionnel.
 */
export function getInvoiceTypeLabel(
  type: InvoiceType | null | undefined,
  depositPercentage?: number | null,
): string {
  switch (type) {
    case 'acompte':
      return depositPercentage ? `Acompte ${formatPercentage(depositPercentage)}` : 'Acompte';
    case 'solde':
      return 'Solde';
    default:
      return 'Facture';
  }
}

function formatPercentage(pct: number): string {
  if (!Number.isFinite(pct)) return '';
  // 30 → "30 %", 33.33 → "33,33 %"
  if (Number.isInteger(pct)) return `${pct} %`;
  return `${pct.toFixed(2).replace('.', ',')} %`;
}
