/**
 * Avoirs (factures rectificatives) — helpers métier.
 *
 * En droit français, une facture émise est intangible : on ne la modifie ni
 * ne la supprime (art. L.102 B LPF, L.123-22 c. com.). La seule façon de
 * corriger une erreur, d'accorder un geste commercial ou d'acter une
 * annulation est d'émettre un **avoir**, qui est lui-même une facture à part
 * entière (art. 289 CGI) et doit référencer la facture rectifiée de façon
 * spécifique et non équivoque. C'est aussi la seule façon de récupérer la
 * TVA collectée (art. 272-1 et 283-3 CGI).
 *
 * ## Conventions
 *
 * - Un avoir est une ligne de `invoices` avec `invoice_type = 'avoir'` et
 *   `credited_invoice_id` pointant sur la facture rectifiée.
 * - Ses montants sont **négatifs** (`total_ht`, `total_tva`, `total_ttc`,
 *   `tva_breakdown`, et chaque `invoice_lines.unit_price` / `.total`).
 *   Presque tous les agrégats de l'app sont des sommes additives sur
 *   `total_ttc` : le signe négatif les rend justes par défaut.
 * - Il prend un numéro dans une **série dédiée** `AV-YYYY-NNN`
 *   (cf. `getNextCreditNoteNumber`). La contrainte d'unicité étant
 *   `(user_id, invoice_number)`, les deux séries cohabitent sans collision
 *   et chacune reste continue, comme l'exige l'administration fiscale.
 * - Le statut de la facture créditée n'est **jamais** modifié : la passer à
 *   `annulee` la sortirait des agrégats *en plus* de la déduction portée par
 *   l'avoir, donc déduirait deux fois. L'état « créditée » se dérive de
 *   l'existence d'avoirs, via `netDueTtc` / `isFullyCredited`.
 * - Un avoir n'est jamais encaissable : pas de bouton payer, pas de RIB, pas
 *   de relance, pas d'échéance.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type InvoiceType = 'standard' | 'acompte' | 'solde' | 'avoir';

/** Préfixe de la série de numérotation dédiée aux avoirs. */
export const CREDIT_NOTE_PREFIX = 'AV' as const;

/** Statuts d'une facture qui la rendent « émise », donc rectifiable par avoir. */
export const CREDITABLE_STATUSES = ['creee', 'envoyee', 'payee', 'en_retard'] as const;

/** Motifs d'avoir proposés à l'artisan. Texte libre possible en plus. */
export const CREDIT_REASONS = [
  { value: 'erreur_facturation', label: 'Erreur de facturation' },
  { value: 'geste_commercial', label: 'Geste commercial / remise' },
  { value: 'annulation', label: 'Annulation de la commande' },
  { value: 'travaux_non_realises', label: 'Travaux non réalisés' },
  { value: 'retour_materiel', label: 'Retour de matériel' },
  { value: 'litige', label: 'Litige / réclamation client' },
  { value: 'autre', label: 'Autre motif' },
] as const;

export function creditReasonLabel(value: string | null | undefined): string {
  if (!value) return '';
  const known = CREDIT_REASONS.find((r) => r.value === value);
  return known ? known.label : value;
}

/** Arrondi à 2 décimales — même règle que lib/tva.ts. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Forme minimale d'un avoir telle que l'app la manipule. */
export interface CreditNoteRef {
  id: string;
  invoice_number: string;
  /** Négatif. */
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  status: string;
  credited_invoice_id: string;
  credit_reason?: string | null;
  issued_at?: string | null;
  created_at?: string | null;
}

export function isCreditNote(invoice: { invoice_type?: string | null } | null | undefined): boolean {
  return invoice?.invoice_type === 'avoir';
}

/**
 * Un avoir en brouillon n'est pas émis : il ne déduit rien et ne compte pas
 * dans le chiffre d'affaires. Même règle que pour une facture en brouillon.
 */
export function isIssuedCreditNote(note: { status?: string | null }): boolean {
  return note.status !== 'brouillon';
}

/**
 * Somme TTC des avoirs émis (donc **négative ou nulle**).
 */
export function sumCreditNotesTtc(notes: Array<Pick<CreditNoteRef, 'total_ttc' | 'status'>>): number {
  return round2(
    notes.filter(isIssuedCreditNote).reduce((sum, n) => sum + num(n.total_ttc), 0),
  );
}

/** Idem en HT. */
export function sumCreditNotesHt(notes: Array<Pick<CreditNoteRef, 'total_ht' | 'status'>>): number {
  return round2(
    notes.filter(isIssuedCreditNote).reduce((sum, n) => sum + num(n.total_ht), 0),
  );
}

/**
 * Montant TTC réellement dû sur une facture, avoirs déduits.
 *
 * C'est la valeur à utiliser partout où l'app parle d'« impayé », de
 * « reste à encaisser », de relance ou d'échéance — jamais `total_ttc` brut,
 * sinon on réclame au client un montant qu'on lui a déjà crédité.
 *
 * Borné à 0 : si les avoirs dépassent la facture (cas anormal mais possible
 * en cumulant plusieurs avoirs partiels), on ne doit rien, on ne redevient
 * pas créditeur de ce côté-ci du calcul.
 */
export function netDueTtc(
  invoice: { total_ttc: number | null | undefined },
  notes: Array<Pick<CreditNoteRef, 'total_ttc' | 'status'>>,
): number {
  return round2(Math.max(0, num(invoice.total_ttc) + sumCreditNotesTtc(notes)));
}

/**
 * Montant TTC net d'une facture pour le chiffre d'affaires : peut être
 * négatif si sur-crédité, contrairement à `netDueTtc` qui est borné à 0.
 */
export function netRevenueTtc(
  invoice: { total_ttc: number | null | undefined },
  notes: Array<Pick<CreditNoteRef, 'total_ttc' | 'status'>>,
): number {
  return round2(num(invoice.total_ttc) + sumCreditNotesTtc(notes));
}

/**
 * La facture est-elle intégralement créditée ? Elle doit alors sortir des
 * files d'action (relances, échéances, « à encaisser ») sans pour autant
 * sortir des agrégats comptables — l'avoir négatif s'en charge.
 *
 * Tolérance d'un centime pour absorber les arrondis de TVA.
 */
export function isFullyCredited(
  invoice: { total_ttc: number | null | undefined },
  notes: Array<Pick<CreditNoteRef, 'total_ttc' | 'status'>>,
): boolean {
  const total = num(invoice.total_ttc);
  if (total <= 0) return false;
  return netDueTtc(invoice, notes) <= 0.01;
}

export function isPartiallyCredited(
  invoice: { total_ttc: number | null | undefined },
  notes: Array<Pick<CreditNoteRef, 'total_ttc' | 'status'>>,
): boolean {
  const credited = sumCreditNotesTtc(notes);
  return credited < 0 && !isFullyCredited(invoice, notes);
}

/**
 * Montant TTC encore créditable sur une facture — l'artisan ne peut pas
 * émettre plus d'avoirs que le montant facturé.
 */
export function remainingCreditableTtc(
  invoice: { total_ttc: number | null | undefined; invoice_type?: string | null },
  notes: Array<Pick<CreditNoteRef, 'total_ttc' | 'status'>>,
  depositsTtc = 0,
): number {
  return round2(Math.max(0, claimedTtc(invoice, depositsTtc) + sumCreditNotesTtc(notes)));
}

/**
 * Montant TTC réellement réclamé par une facture, avant tout avoir.
 *
 * Une facture de **solde** stocke le total BRUT du devis dans `total_ttc` : la
 * déduction des acomptes déjà facturés est une vue recalculée à la lecture.
 * Un avoir total construit sur `total_ttc` créditerait donc au client bien
 * plus que ce que cette facture lui a réclamé — acomptes compris, alors qu'ils
 * ont leur propre facture et, le cas échéant, leur propre avoir.
 *
 * `depositsTtc` doit déjà être net des avoirs émis sur les acomptes.
 */
export function claimedTtc(
  invoice: { total_ttc: number | null | undefined; invoice_type?: string | null },
  depositsTtc = 0,
): number {
  const gross = num(invoice.total_ttc);
  if (invoice.invoice_type !== 'solde') return round2(gross);
  return round2(Math.max(0, gross - Math.abs(num(depositsTtc))));
}

/**
 * Part HT correspondant à `claimedTtc`, obtenue au prorata du TTC — même règle
 * que l'export FEC, pour que HT + TVA reste égal au TTC effectif.
 */
export function claimedHt(
  invoice: {
    total_ht: number | null | undefined;
    total_ttc: number | null | undefined;
    invoice_type?: string | null;
  },
  depositsTtc = 0,
): number {
  const grossHt = num(invoice.total_ht);
  const grossTtc = num(invoice.total_ttc);
  if (invoice.invoice_type !== 'solde' || grossTtc <= 0) return round2(grossHt);
  return round2((claimedTtc(invoice, depositsTtc) * grossHt) / grossTtc);
}

/**
 * Charge les avoirs rattachés à un lot de factures, indexés par
 * `credited_invoice_id`. Un seul aller-retour, à appeler une fois par écran
 * plutôt qu'une fois par ligne.
 */
export async function fetchCreditNotesByInvoice(
  supabase: SupabaseClient,
  invoiceIds: string[],
): Promise<Map<string, CreditNoteRef[]>> {
  const map = new Map<string, CreditNoteRef[]>();
  const ids = invoiceIds.filter(Boolean);
  if (ids.length === 0) return map;

  const { data } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, total_ht, total_tva, total_ttc, status, credited_invoice_id, credit_reason, issued_at, created_at',
    )
    .eq('invoice_type', 'avoir')
    .in('credited_invoice_id', ids);

  for (const row of (data as CreditNoteRef[] | null) || []) {
    if (!row.credited_invoice_id) continue;
    const list = map.get(row.credited_invoice_id) || [];
    list.push({
      ...row,
      total_ht: num(row.total_ht),
      total_tva: num(row.total_tva),
      total_ttc: num(row.total_ttc),
    });
    map.set(row.credited_invoice_id, list);
  }
  return map;
}

/**
 * Somme TTC des acomptes d'un devis, **nette des avoirs émis sur chacun**.
 *
 * Un acompte intégralement crédité n'a plus rien réclamé au client : continuer
 * à le déduire de la facture de solde ferait payer au client moins que le
 * montant annoncé, et retirerait deux fois le même montant du chiffre
 * d'affaires — l'avoir portant déjà sa propre ligne négative.
 *
 * C'est la valeur à passer comme `depositsTtc` à `claimedTtc` / `claimedHt` /
 * `remainingCreditableTtc`. Toutes les routes de paiement, l'aperçu, le PDF et
 * la page publique doivent partir d'ici : c'est la seule façon d'aligner le
 * montant affiché sur le montant réellement débité.
 */
export async function fetchDepositsNetTtc(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<number> {
  const { data } = await supabase
    .from('invoices')
    .select('id, total_ttc')
    .eq('quote_id', quoteId)
    .eq('invoice_type', 'acompte')
    .neq('status', 'annulee');

  const deposits = (data as Array<{ id: string; total_ttc: number | null }> | null) || [];
  if (deposits.length === 0) return 0;

  const notes = await fetchCreditNotesByInvoice(
    supabase,
    deposits.map((d) => d.id),
  );
  return round2(
    deposits.reduce((sum, d) => sum + netDueTtc(d, notes.get(d.id) || []), 0),
  );
}

/**
 * Ligne de facture telle que stockée. Les champs `detail`, `section` et
 * `subsection` portent la structure du document : les perdre aplatit le
 * rendu de l'avoir et empêche le client de rapprocher ligne à ligne.
 */
export interface SourceInvoiceLine {
  description: string | null;
  detail?: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  tva_rate: number | null;
  section?: string | null;
  subsection?: string | null;
  total: number | null;
  position: number | null;
}

export interface CreditNoteLineInsert {
  user_id: string;
  invoice_id: string;
  description: string;
  detail: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  tva_rate: number;
  section: string | null;
  subsection: string | null;
  total: number;
  position: number;
}

/**
 * Avoir **total** : miroir exact des lignes de la facture rectifiée, signes
 * inversés. On conserve `quantity` positif et on inverse `unit_price` /
 * `total`, de sorte que `quantity * unit_price === total` reste vrai — c'est
 * l'invariant sur lequel s'appuie `computeTvaBreakdown`.
 *
 * On reprend `tva_rate` ligne à ligne : sans cela, la colonne retombe sur son
 * DEFAULT de 20 % et fabrique une TVA régularisée fausse sur un chantier à
 * taux réduit (10 % rénovation, 5,5 % rénovation énergétique).
 */
export function buildFullCreditNoteLines(
  sourceLines: SourceInvoiceLine[],
  userId: string,
  creditNoteId: string,
): CreditNoteLineInsert[] {
  return sourceLines.map((line, index) => {
    // Le repli à 1 ne vaut que pour une quantité ABSENTE (import ancien, ligne
    // sans quantité saisie). Une quantité 0 explicite — l'éditeur de devis
    // l'accepte, et la ligne ne pèse alors rien dans les totaux de la facture —
    // doit rester 0 : la transformer en 1 ferait créditer au client un montant
    // que la facture ne lui a jamais facturé, et pourrait faire sauter le
    // plafond de créditation contrôlé en base.
    const hasQuantity = line.quantity !== null && line.quantity !== undefined;
    const quantity = hasQuantity ? num(line.quantity) : 1;
    const unitPrice = num(line.unit_price);
    // Le total est dérivé de la quantité réellement retenue, sinon l'invariant
    // `quantity * unit_price === total` — celui sur lequel s'appuie
    // `computeTvaBreakdown` — serait faux dès que la quantité est repliée.
    const total = hasQuantity && line.total !== null && line.total !== undefined
      ? num(line.total)
      : round2(quantity * unitPrice);

    return {
      user_id: userId,
      invoice_id: creditNoteId,
      description: line.description || 'Prestation',
      detail: line.detail ?? null,
      quantity,
      unit: line.unit ?? null,
      unit_price: round2(-unitPrice),
      tva_rate: line.tva_rate === null || line.tva_rate === undefined ? 20 : num(line.tva_rate),
      section: line.section ?? null,
      subsection: line.subsection ?? null,
      total: round2(-total),
      position: line.position === null || line.position === undefined ? index : num(line.position),
    };
  });
}

/**
 * Avoir **partiel** : une ligne unique portant le montant crédité, au taux
 * de TVA choisi. C'est la forme qu'utilisent les logiciels de compta pour un
 * geste commercial ou une régularisation, et elle évite d'avoir à ventiler
 * arbitrairement une remise sur des lignes multi-taux.
 */
export function buildPartialCreditNoteLine(
  params: {
    amountHt: number;
    tvaRate: number;
    label: string;
    userId: string;
    creditNoteId: string;
  },
): CreditNoteLineInsert {
  const amountHt = Math.abs(num(params.amountHt));
  return {
    user_id: params.userId,
    invoice_id: params.creditNoteId,
    description: params.label,
    detail: null,
    quantity: 1,
    unit: 'forfait',
    unit_price: round2(-amountHt),
    tva_rate: num(params.tvaRate),
    section: null,
    subsection: null,
    total: round2(-amountHt),
    position: 0,
  };
}

/**
 * Mention légale à faire figurer sur l'avoir. La référence à la facture
 * rectifiée est obligatoire (art. 242 nonies A ann. II CGI) et la mention
 * de régularisation de TVA conditionne la récupération de la TVA collectée.
 */
export function buildCreditNoteLegalMention(params: {
  creditedInvoiceNumber: string;
  creditedInvoiceDate?: string | null;
}): string {
  const datePart = params.creditedInvoiceDate
    ? ` du ${new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(params.creditedInvoiceDate))}`
    : '';
  return (
    `Avoir rattaché à la facture ${params.creditedInvoiceNumber}${datePart}. ` +
    `TVA régularisée conformément à l'article 272-1 du Code général des impôts. ` +
    `Ce document ne donne lieu à aucun paiement de votre part.`
  );
}

/** Libellé court du type de facture, pour badges et titres de documents. */
export function invoiceTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'avoir':
      return 'Avoir';
    case 'acompte':
      return 'Acompte';
    case 'solde':
      return 'Solde';
    default:
      return 'Facture';
  }
}
