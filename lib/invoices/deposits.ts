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
 *  - le calcul du montant d'un acompte (en % ou en montant HT).
 *
 * ## Avoirs
 *
 * Un avoir (`invoice_type = 'avoir'`) n'est pas une facture du devis : il
 * rectifie une facture existante, en montants négatifs, et peut porter le
 * `quote_id` de la facture qu'il crédite selon le point d'entrée qui l'a
 * créé. Il ne doit donc jamais entrer dans la liste des factures du devis —
 * sinon il déclenche les garde-fous "il existe déjà un solde / une facture
 * standard" et bloque définitivement la facturation.
 *
 * Toutes les sommes de ce fichier sont **nettes des avoirs émis** :
 *  - "déjà facturé" déduit les avoirs émis sur les acomptes, sans quoi la
 *    facture de solde déduirait un acompte que l'avoir a déjà annulé et le
 *    client sous-paierait ;
 *  - "encaissé" déduit les avoirs émis sur les factures payées ;
 *  - "reste à facturer" se rouvre si le solde a été intégralement crédité :
 *    l'artisan doit pouvoir refacturer après avoir annulé sa facture.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchCreditNotesByInvoice,
  sumCreditNotesTtc,
  type CreditNoteRef,
  type InvoiceType,
} from '@/lib/invoices/credit-notes';

// Une seule définition de `InvoiceType` dans l'app, celle du module avoirs.
export type { InvoiceType };

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

/** Ligne brute renvoyée par la requête : inclut les avoirs rattachés au devis. */
type BillingRow = DepositInvoice & {
  credited_invoice_id?: string | null;
  credit_reason?: string | null;
};

export interface QuoteBillingSummary {
  /** Total TTC du devis */
  quoteTotalTtc: number;
  /** Total HT du devis */
  quoteTotalHt: number;
  /**
   * Factures liées au devis (acomptes + solde + standard si existant),
   * triées par date. **Les avoirs en sont exclus** : ils rectifient ces
   * factures, ils ne facturent pas le devis.
   */
  invoices: DepositInvoice[];
  /** Avoirs émis sur les factures ci-dessus, triés par date (montants négatifs) */
  creditNotes: CreditNoteRef[];
  /** Les mêmes avoirs, indexés par `credited_invoice_id` */
  creditNotesByInvoice: Map<string, CreditNoteRef[]>;
  /** Somme TTC facturée, **nette des avoirs émis** (brouillon + envoyée + payée) */
  invoicedTtc: number;
  /** Somme TTC des acomptes, nette des avoirs émis sur ces acomptes */
  invoicedFromDepositsTtc: number;
  /** Somme TTC des acomptes avant déduction des avoirs */
  depositsGrossTtc: number;
  /** Somme TTC des avoirs émis sur les factures du devis (négative ou nulle) */
  creditedTtc: number;
  /**
   * Part des avoirs réellement absorbée par la facturation du devis (positive).
   * Diffère de `-creditedTtc` dans deux cas : un avoir dépasse la contribution
   * réelle de la facture qu'il rectifie (la facture de solde stocke le total
   * brut du devis mais ne réclame que le reste après acomptes) ; ou un avoir
   * sur un acompte est repris par la facture de solde, qui réclame alors ce
   * montant au client — l'avoir n'a rien fait perdre au devis.
   */
  appliedCreditTtc: number;
  /** Somme TTC réellement encaissée (factures payées), nette des avoirs */
  collectedTtc: number;
  /**
   * Reste à facturer TTC = total du devis − déjà facturé net.
   * Se rouvre si une facture de solde ou standard est intégralement créditée.
   */
  remainingTtc: number;
  /** Reste à encaisser = devis − avoirs absorbés − encaissé (borné à 0) */
  outstandingTtc: number;
  /** Existe-t-il une facture de solde **active** (non annulée par un avoir) ? */
  hasFinalInvoice: boolean;
  /** Existe-t-il une facture standard **active** (flow direct "facturer en totalité") ? */
  hasStandardInvoice: boolean;
  /** Au moins un avoir a-t-il été émis sur une facture de ce devis ? */
  hasCreditNotes: boolean;
  /**
   * Factures économiquement annulées par leurs avoirs : elles restent
   * affichées (une facture émise ne disparaît jamais) mais ne bloquent plus
   * la refacturation et ne sont plus à encaisser.
   */
  cancelledByCreditIds: Set<string>;
}

/**
 * Arrondi à 2 décimales — même règle que lib/tva.ts pour rester cohérent
 * entre les différents calculs.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Clé de tri chronologique commune aux factures et aux avoirs. */
function timeKey(row: { issued_at?: string | null; created_at?: string | null }): number {
  const raw = row.issued_at || row.created_at;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Avoirs d'une facture donnée dans un résumé de facturation.
 * Raccourci pour l'UI, qui n'a pas à connaître la forme de la Map.
 */
export function creditNotesFor(
  summary: Pick<QuoteBillingSummary, 'creditNotesByInvoice'>,
  invoiceId: string,
): CreditNoteRef[] {
  return summary.creditNotesByInvoice.get(invoiceId) || [];
}

/** La facture est-elle intégralement couverte par ses avoirs ? */
export function isInvoiceCancelledByCredits(
  summary: Pick<QuoteBillingSummary, 'cancelledByCreditIds'>,
  invoiceId: string,
): boolean {
  return summary.cancelledByCreditIds.has(invoiceId);
}

/**
 * Récupère toutes les factures liées à un devis, leurs avoirs, et calcule le
 * résumé de facturation. Exclut les factures annulées (status = 'annulee'),
 * ainsi que les avoirs annulés ou en brouillon (qui ne déduisent rien).
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
      'id, invoice_number, invoice_type, deposit_percentage, total_ht, total_tva, total_ttc, status, paid_at, issued_at, created_at, quote_id, credited_invoice_id, credit_reason',
    )
    .eq('quote_id', quoteId)
    .neq('status', 'annulee')
    .order('issued_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  const rows = ((data as BillingRow[] | null) || []).map((row) => ({
    ...row,
    total_ht: num(row.total_ht),
    total_tva: num(row.total_tva),
    total_ttc: num(row.total_ttc),
    deposit_percentage:
      row.deposit_percentage === null || row.deposit_percentage === undefined
        ? null
        : num(row.deposit_percentage),
  }));

  // Un avoir rattaché au devis reste un avoir : il sort de la liste des
  // factures pour rejoindre celle des rectifications.
  const invoices: DepositInvoice[] = rows.filter((r) => r.invoice_type !== 'avoir');
  const invoiceIds = invoices.map((i) => i.id);
  const invoiceIdSet = new Set(invoiceIds);

  // Les avoirs peuvent porter le quote_id (créés depuis le devis) ou non
  // (créés depuis la page Factures) : on cumule les deux sources et on
  // dédoublonne par id.
  const notesById = new Map<string, CreditNoteRef>();
  for (const row of rows) {
    if (row.invoice_type !== 'avoir' || !row.credited_invoice_id) continue;
    notesById.set(row.id, {
      id: row.id,
      invoice_number: row.invoice_number,
      total_ht: row.total_ht,
      total_tva: row.total_tva,
      total_ttc: row.total_ttc,
      status: row.status,
      credited_invoice_id: row.credited_invoice_id,
      credit_reason: row.credit_reason ?? null,
      issued_at: row.issued_at,
      created_at: row.created_at,
    });
  }
  const fetched = await fetchCreditNotesByInvoice(supabase, invoiceIds);
  fetched.forEach((list) => {
    for (const note of list) notesById.set(note.id, note);
  });

  const creditNotesByInvoice = new Map<string, CreditNoteRef[]>();
  const creditNotes: CreditNoteRef[] = [];
  notesById.forEach((note) => {
    // Un avoir annulé ou en brouillon ne déduit rien — même règle que pour
    // une facture (cf. isIssuedCreditNote côté credit-notes).
    if (note.status === 'annulee' || note.status === 'brouillon') return;
    // Un avoir orphelin (facture créditée annulée, donc hors de ce résumé)
    // n'a plus rien à déduire ici.
    if (!invoiceIdSet.has(note.credited_invoice_id)) return;
    const list = creditNotesByInvoice.get(note.credited_invoice_id) || [];
    list.push(note);
    creditNotesByInvoice.set(note.credited_invoice_id, list);
    creditNotes.push(note);
  });
  creditNotes.sort((a, b) => timeKey(a) - timeKey(b));
  creditNotesByInvoice.forEach((list) => list.sort((a, b) => timeKey(a) - timeKey(b)));

  /** Avoirs (négatifs) portés par une facture. */
  const creditsOf = (invoiceId: string): number =>
    sumCreditNotesTtc(creditNotesByInvoice.get(invoiceId) || []);

  const deposits = invoices.filter((i) => i.invoice_type === 'acompte');
  const finalInvoices = invoices.filter(
    (i) => i.invoice_type === 'solde' || i.invoice_type === 'standard',
  );

  const depositsGrossTtc = round2(deposits.reduce((sum, i) => sum + i.total_ttc, 0));
  const invoicedFromDepositsTtc = Math.max(
    0,
    round2(depositsGrossTtc + round2(deposits.reduce((sum, i) => sum + creditsOf(i.id), 0))),
  );

  /**
   * Ce qu'une facture de solde ajoute réellement au devis.
   * La facture de solde stocke le total **brut** du devis (voir
   * CreateFinalInvoiceDialog) mais ne réclame au client que le reste après
   * acomptes : c'est ce reste qui compte comme facturation nouvelle.
   *
   * Les acomptes déduits sont les acomptes **nets de leurs avoirs**, comme le
   * fait la vue publique (`get_public_invoice_by_token`) et le dialog de
   * création du solde. Retrancher les acomptes bruts laisserait déduit ici un
   * acompte que l'avoir a annulé, alors que le solde le réclame bel et bien au
   * client : le devis afficherait un « reste à facturer » fantôme qu'aucun
   * bouton ne peut facturer, et un encaissement sous-évalué.
   */
  const finalPotTtc =
    finalInvoices.length > 0 ? Math.max(0, round2(quoteTotalTtc - invoicedFromDepositsTtc)) : 0;

  /**
   * Le même pot, mais **avant** tout avoir. Il sert uniquement de référence
   * pour mesurer la part des avoirs réellement absorbée par la facturation
   * (cf. `appliedCreditTtc`) : un avoir sur un acompte que le solde reprend
   * ensuite à son compte n'est absorbé par personne.
   */
  const grossFinalPotTtc =
    finalInvoices.length > 0 ? Math.max(0, round2(quoteTotalTtc - depositsGrossTtc)) : 0;

  /** Contribution effective d'une facture au total du devis, avoirs exclus. */
  const grossContributionOf = (invoice: DepositInvoice): number => {
    if (invoice.invoice_type === 'solde') {
      return Math.min(invoice.total_ttc, finalPotTtc);
    }
    // Une facture standard n'affiche aucune déduction d'acompte : elle réclame
    // son propre total. On la plafonne au total du devis, jamais au pot des
    // acomptes, sinon elle contribuerait moins que ce qu'elle facture.
    if (invoice.invoice_type === 'standard') {
      return quoteTotalTtc > 0 ? Math.min(invoice.total_ttc, quoteTotalTtc) : invoice.total_ttc;
    }
    return invoice.total_ttc;
  };

  /**
   * Une facture intégralement couverte par ses avoirs est économiquement
   * annulée : elle ne bloque plus la refacturation. On raisonne sur la
   * contribution effective, pas sur le total stocké, sinon un avoir qui
   * annule un solde (au reste dû) passerait pour partiel.
   */
  const isCancelledByCredits = (invoice: DepositInvoice): boolean => {
    const due = grossContributionOf(invoice);
    if (due <= 0) return false;
    const credited = -creditsOf(invoice.id);
    return credited >= due - 0.01;
  };

  const cancelledByCreditIds = new Set(
    invoices.filter((i) => isCancelledByCredits(i)).map((i) => i.id),
  );

  const hasFinalInvoice = finalInvoices.some(
    (i) => i.invoice_type === 'solde' && !isCancelledByCredits(i),
  );
  const hasStandardInvoice = finalInvoices.some(
    (i) => i.invoice_type === 'standard' && !isCancelledByCredits(i),
  );

  // Le total facturé plafonne au "pot" restant : deux factures de solde
  // successives (après annulation de la première par avoir) ne facturent pas
  // deux fois le même reste.
  const invoicedFromFinalTtc = Math.min(
    finalPotTtc,
    round2(
      finalInvoices.reduce(
        (sum, i) => sum + Math.max(0, round2(grossContributionOf(i) + creditsOf(i.id))),
        0,
      ),
    ),
  );

  const invoicedTtc = round2(invoicedFromDepositsTtc + invoicedFromFinalTtc);
  const creditedTtc = sumCreditNotesTtc(creditNotes);
  const appliedCreditTtc = Math.max(
    0,
    round2(depositsGrossTtc + grossFinalPotTtc - invoicedTtc),
  );

  // Encaissé : pour une facture de solde, le client n'a jamais réglé le total
  // brut stocké mais le reste après acomptes. On retient donc la contribution
  // effective, diminuée des avoirs émis.
  const collectedTtc = round2(
    invoices
      .filter((i) => i.status === 'payee')
      .reduce((sum, i) => sum + Math.max(0, round2(grossContributionOf(i) + creditsOf(i.id))), 0),
  );

  const remainingTtc = Math.max(0, round2(quoteTotalTtc - invoicedTtc));
  const outstandingTtc = Math.max(
    0,
    round2(quoteTotalTtc - appliedCreditTtc - collectedTtc),
  );

  return {
    quoteTotalTtc,
    quoteTotalHt,
    invoices,
    creditNotes,
    creditNotesByInvoice,
    invoicedTtc,
    invoicedFromDepositsTtc,
    depositsGrossTtc,
    creditedTtc,
    appliedCreditTtc,
    collectedTtc,
    remainingTtc,
    outstandingTtc,
    hasFinalInvoice,
    hasStandardInvoice,
    hasCreditNotes: creditNotes.length > 0,
    cancelledByCreditIds,
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

/** 30 → "30 %", 33.33 → "33,33 %". */
export function formatDepositPercentage(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '';
  if (Number.isInteger(pct)) return `${pct} %`;
  return `${pct.toFixed(2).replace('.', ',')} %`;
}
