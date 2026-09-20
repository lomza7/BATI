/**
 * Costructor (and generic CSV) mapper for the Hellobat import flow.
 *
 * This module turns the CSV exports from Costructor — and any other software
 * that follows similar conventions — into rows that match our Supabase schema
 * for `clients`, `quotes` (+ `quote_lines`), and `invoices` (+ `invoice_lines`).
 *
 * The mapping is intentionally permissive:
 * - Header names are matched fuzzily so that minor wording differences (Excel
 *   files, English exports, lowercase variants) still work.
 * - Encoding mojibake (Ã©, Å¾, Â°) is repaired in a post-decode pass.
 * - Anything that can't be parsed becomes a row in `errors`, never a thrown
 *   exception — the user must always be able to see the preview, even if half
 *   the file is malformed.
 * - Une ligne d'avoir (facture rectificative) est reconnue comme telle et
 *   mappée vers `invoice_type = 'avoir'` avec des montants négatifs. Elle
 *   n'est plus aplatie en facture annulée, ce qui détruisait l'information de
 *   crédit. Voir la section « Avoirs » en bas de fichier.
 */

import {
  CREDIT_NOTE_PREFIX,
  CREDIT_REASONS,
  isCreditNote,
  type InvoiceType,
} from '@/lib/invoices/credit-notes';
import type { ParsedCSV } from './csv-parser';

// ── Types ────────────────────────────────────────────────────────────────────

export type ContactType = 'client' | 'prospect' | 'prestataire';
export type QuoteStatus = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire';
export type InvoiceStatus =
  | 'brouillon'
  | 'creee'
  | 'envoyee'
  | 'payee'
  | 'en_retard'
  | 'annulee';

export interface MappedClient {
  /** External row id (line number for traceability in the preview UI) */
  externalId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  notes: string;
  contact_type: ContactType;
}

export interface MappedQuote {
  externalId: string;
  /** Original number from the source software (kept for traceability). */
  source_number: string;
  /** Client name as referenced in the source CSV (we'll resolve to client_id later). */
  client_name: string;
  title: string;
  description: string;
  status: QuoteStatus;
  total_ht: number;
  tva_rate: number;
  total_ttc: number;
  issued_at: string | null;
  valid_until: string | null;
}

export interface MappedInvoice {
  externalId: string;
  /** Ligne du CSV (en-tête = 1), pour pointer l'artisan au bon endroit. */
  line: number;
  source_number: string;
  source_quote_number: string; // empty if none
  client_name: string;
  title: string;
  status: InvoiceStatus;
  /**
   * `'avoir'` pour une facture rectificative, `'standard'` sinon. Les autres
   * types (`acompte`, `solde`) ne sont pas détectables de façon fiable dans un
   * export concurrent : ils exigeraient un devis rattaché, que l'import n'a
   * pas toujours.
   */
  invoice_type: InvoiceType;
  /**
   * Avoirs uniquement : numéro, dans le fichier source, de la facture
   * rectifiée. Vide si le CSV ne le porte pas. C'est à la route d'import de le
   * résoudre en `credited_invoice_id` — la base refuse un avoir sans facture
   * rectifiée valide (cf. `validate_credit_note`). Toujours vide quand
   * `invoice_type !== 'avoir'`.
   */
  credited_source_number: string;
  /** Avoirs uniquement : motif, normalisé sur `CREDIT_REASONS` quand possible. */
  credit_reason: string | null;
  /**
   * `false` quand la ligne ne doit PAS donner lieu à la création d'un chantier
   * — cas des avoirs, dont le montant négatif fabriquerait un chantier à
   * budget négatif. Les routes d'import doivent tester ce drapeau avant
   * d'insérer dans `projects`.
   */
  creates_project: boolean;
  /** Négatif pour un avoir. */
  total_ht: number;
  /** Négatif pour un avoir. */
  total_tva: number;
  tva_rate: number;
  /** Négatif pour un avoir. */
  total_ttc: number;
  issued_at: string | null;
  /** Toujours `null` sur un avoir : il n'est pas encaissable, donc sans échéance. */
  due_date: string | null;
  /** Toujours `null` sur un avoir. */
  paid_at: string | null;
}

export interface MappedService {
  externalId: string;
  name: string;
  description: string;
  unit: string;
  unit_price: number;
  category: string;
  tva_rate: number;
}

/**
 * Avertissement non bloquant du rapport d'import : la ligne a bien été
 * importée, mais dégradée. À afficher à l'artisan en français, à côté des
 * erreurs, pour qu'il sache ce qu'il doit corriger dans son fichier.
 */
export interface ImportWarning {
  line: number;
  reason: string;
  hint?: string;
}

export interface ImportSummary<T> {
  rows: T[];
  errors: { line: number; reason: string }[];
  warnings: ImportWarning[];
}

// ── Mojibake repair ──────────────────────────────────────────────────────────

/**
 * Repair the most common French mojibake patterns. Costructor, Excel/Windows
 * and similar tools often emit UTF-8 bytes that *originally* encoded a
 * Windows-1252 string — i.e. each Latin-1 byte was UTF-8-re-encoded once. The
 * result decodes as valid UTF-8 but reads as `Ã©` instead of `é`.
 *
 * Strategy: convert the string back to bytes via Latin-1, then re-decode as
 * UTF-8. If the round-trip yields fewer replacement chars than the original,
 * we keep the repaired version.
 */
export function repairMojibake(text: string): string {
  // Quick exit for ASCII-only payloads
  if (!/[\u0080-\uFFFF]/.test(text)) return text;

  // Detect the smell of doubly-encoded UTF-8 in a Windows-1252 wrapper.
  if (!/Ã.|Å.|Â.|â.|ï¿½/.test(text)) return text;

  try {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // Anything outside Latin-1 means the round-trip is unsafe — bail.
      if (code > 0xff) return text;
      bytes[i] = code;
    }
    const repaired = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    // Sanity: did the repair actually reduce the number of accented mojibake
    // sequences? If yes, accept the new string; otherwise keep the original.
    const beforeBad = (text.match(/Ã.|Å.|Â./g) || []).length;
    const afterBad = (repaired.match(/Ã.|Å.|Â./g) || []).length;
    if (afterBad < beforeBad) return repaired;
    return text;
  } catch {
    return text;
  }
}

/**
 * Apply mojibake repair to every cell of a parsed CSV.
 */
export function repairParsedCsv(parsed: ParsedCSV): ParsedCSV {
  const headers = parsed.headers.map(repairMojibake);
  const rows = parsed.rows.map((row) => {
    const out: Record<string, string> = {};
    let i = 0;
    for (const oldKey of Object.keys(row)) {
      const newKey = headers[i] ?? oldKey;
      out[newKey] = repairMojibake(row[oldKey] ?? '');
      i++;
    }
    return out;
  });
  return { ...parsed, headers, rows };
}

// ── Header resolution ────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Find the first header in a parsed row that matches one of `candidates`
 * (each candidate is matched after normalization). Returns the cell value
 * trimmed, or '' when no match.
 */
function pick(row: Record<string, string>, candidates: string[]): string {
  const normalizedRow = new Map<string, string>();
  for (const key of Object.keys(row)) {
    normalizedRow.set(normalizeHeader(key), row[key]);
  }
  for (const c of candidates) {
    const n = normalizeHeader(c);
    // Exact match wins
    if (normalizedRow.has(n)) {
      const v = normalizedRow.get(n) ?? '';
      if (v) return v.trim();
    }
  }
  // Fallback: substring match (e.g. "email pro" should match "email")
  const entries = Array.from(normalizedRow.entries());
  for (const [k, v] of entries) {
    for (const c of candidates) {
      const n = normalizeHeader(c);
      if (k.includes(n) && v) return v.trim();
    }
  }
  return '';
}

// ── Field parsers ────────────────────────────────────────────────────────────

/**
 * Parse a French-formatted decimal number ("1 234,56", "1.234,56", "1234.56").
 * Returns 0 for unparseable input — the preview UI flags lines whose total is 0.
 */
export function parseFrenchNumber(value: string): number {
  if (!value) return 0;
  let cleaned = value
    .replace(/\s/g, '')
    .replace(/[€$£]/g, '')
    .replace(/,/g, '.');

  // Les logiciels de compta notent souvent les négatifs autrement que par un
  // signe en tête : entre parenthèses « (1.234,56) » ou signe en fin de champ
  // « 1234.56- ». Sans ce traitement, un avoir exporté ainsi remonterait
  // positif (ou nul), donc dans le mauvais sens.
  let negative = false;
  if (/^\(.*\)$/.test(cleaned)) {
    negative = true;
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.endsWith('-')) {
    negative = true;
    cleaned = cleaned.slice(0, -1);
  }

  // If the string contains multiple dots, the leftmost ones are thousands
  // separators ("1.234.56" → "1234.56").
  const parts = cleaned.split('.');
  let normalized: string;
  if (parts.length <= 1) {
    normalized = cleaned;
  } else {
    const decimal = parts.pop() as string;
    normalized = `${parts.join('')}.${decimal}`;
  }
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

/** Arrondi à 2 décimales — même règle que lib/tva.ts. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Détermine le taux de TVA d'un document.
 *
 * La colonne « TVA » d'un export peut contenir soit un taux (20), soit un
 * montant en euros (1 234,56) : on ne retient la valeur telle quelle que si
 * elle ressemble à un taux, sinon on la recalcule depuis les totaux.
 *
 * Le calcul se fait sur les valeurs absolues, pour rester juste sur un avoir
 * dont les deux totaux sont négatifs. Un taux hors de [0, 50] n'a aucun sens
 * (cas typique : un TTC absent, qui donnerait −100 %) : on retombe sur 20 %,
 * le taux à corriger ensuite depuis la fiche document.
 */
function deriveTvaRate(tvaCell: number, totalHt: number, totalTtc: number): number {
  if (tvaCell > 0 && tvaCell <= 50) return tvaCell;
  const ht = Math.abs(totalHt);
  const ttc = Math.abs(totalTtc);
  if (ht > 0 && ttc > 0) {
    const derived = Math.round(((ttc - ht) / ht) * 100);
    if (derived >= 0 && derived <= 50) return derived;
  }
  return 20;
}

/**
 * Parse a date in any of the common French/ISO formats. Returns an ISO date
 * string (YYYY-MM-DD) or null if it can't be parsed.
 */
export function parseFrenchDate(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // ISO already?
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY
  const fr = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (fr) {
    const dd = fr[1].padStart(2, '0');
    const mm = fr[2].padStart(2, '0');
    let yyyy = fr[3];
    if (yyyy.length === 2) yyyy = parseInt(yyyy, 10) > 50 ? `19${yyyy}` : `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  // Last resort: let JS try
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/**
 * Normalize a French phone number. Strips spaces, dots and parentheses, drops
 * the +33 / 33 country prefix and re-adds a leading 0 when relevant.
 */
export function normalizePhone(value: string): string {
  if (!value) return '';
  let p = value.replace(/[^\d+]/g, '');
  if (p.startsWith('+33')) p = '0' + p.slice(3);
  else if (p.startsWith('0033')) p = '0' + p.slice(4);
  else if (/^33\d{9}$/.test(p)) p = '0' + p.slice(2);
  return p;
}

/**
 * Split a free-form French address into address / postal_code / city when
 * possible. The simple heuristic looks for a 5-digit zip code preceded by the
 * street part and followed by the city.
 *
 * If we can't split, the whole string goes into `address` and the other two
 * fields stay empty.
 */
export function splitAddress(value: string): {
  address: string;
  postal_code: string;
  city: string;
} {
  if (!value) return { address: '', postal_code: '', city: '' };
  // Costructor sometimes packs multiple addresses with a newline separator —
  // keep only the first.
  const first = value.split(/\r?\n/)[0].trim();
  const m = first.match(/^(.+?)\s+(\d{5})\s+(.+)$/);
  if (m) {
    return { address: m[1].trim(), postal_code: m[2], city: m[3].trim() };
  }
  return { address: first, postal_code: '', city: '' };
}

// ── Status mappers ───────────────────────────────────────────────────────────

function mapContactType(statut: string, type: string): ContactType {
  const t = (type || statut || '').toLowerCase();
  if (t.includes('prospect')) return 'prospect';
  if (t.includes('presta') || t.includes('fournisseur') || t.includes('sous-tra')) {
    return 'prestataire';
  }
  return 'client';
}

function mapQuoteStatus(value: string): QuoteStatus {
  const s = value.toLowerCase();
  if (!s) return 'brouillon';
  if (s.includes('brouillon') || s.includes('draft')) return 'brouillon';
  if (s.includes('refus') || s.includes('reject')) return 'refuse';
  if (s.includes('expir')) return 'expire';
  if (s.includes('accept') || s.includes('signe') || s.includes('valid')) return 'accepte';
  if (s.includes('final') || s.includes('envoy') || s.includes('sent')) return 'envoye';
  return 'brouillon';
}

function mapInvoiceStatus(value: string): InvoiceStatus {
  const s = value.toLowerCase();
  if (!s) return 'brouillon';
  if (s.includes('brouillon') || s.includes('draft')) return 'brouillon';
  // Note : « avoir » ne vaut plus annulation. Une ligne d'avoir est détectée en
  // amont (cf. detectCreditNote) et devient une facture rectificative à part
  // entière ; elle ne passe jamais par ici.
  if (s.includes('annul') || s.includes('cancel')) return 'annulee';
  if (s.includes('paye') || s.includes('paid') || s.includes('regle') || s.includes('réglé')) return 'payee';
  if (s.includes('retard') || s.includes('overdue')) return 'en_retard';
  if (s.includes('envoy') || s.includes('sent') || s.includes('final')) return 'envoyee';
  if (s.includes('cree') || s.includes('créé') || s.includes('issued') || s.includes('import')) return 'creee';
  return 'creee';
}

/**
 * Statut d'un avoir importé.
 *
 * Un avoir n'est ni encaissable ni exigible : « payée » et « en retard » n'ont
 * aucun sens pour lui. Il n'a donc que deux états utiles ici — brouillon (le
 * fichier le dit explicitement) ou émis. Sans indication, un avoir repris d'un
 * logiciel concurrent est un document historique déjà remis au client : on le
 * considère émis, sinon il ne déduirait rien des agrégats
 * (cf. `isIssuedCreditNote`).
 */
function mapCreditNoteStatus(value: string): InvoiceStatus {
  const s = value.toLowerCase();
  if (s.includes('brouillon') || s.includes('draft')) return 'brouillon';
  return 'envoyee';
}

// ── Row mappers ──────────────────────────────────────────────────────────────

const CONTACT_HEADERS = {
  id: ['ID', 'Identifiant', 'External ID'],
  statut: ['Statut', 'Type particulier'],
  type: ['Type', 'Categorie', 'Catégorie'],
  civilite: ['Civilite', 'Civilité', 'Title'],
  name: ['Nom complet', 'Nom', 'Name', 'Raison sociale', 'Société'],
  firstName: ['Prenom', 'Prénom', 'First name'],
  lastName: ['Nom', 'Last name', 'Family name'],
  email: ['Email', 'Mail', 'E-mail', 'Courriel'],
  phone: ['Telephone', 'Téléphone', 'Mobile', 'Phone', 'Tel'],
  address: ['Adresse', 'Adresses', 'Address'],
  city: ['Ville', 'City'],
  postalCode: ['Code postal', 'CP', 'Postal code', 'Zip'],
  notes: ['Notes', 'Note', 'Commentaire', 'Comment'],
};

export function mapContactsCSV(parsed: ParsedCSV): ImportSummary<MappedClient> {
  const repaired = repairParsedCsv(parsed);
  const rows: MappedClient[] = [];
  const errors: { line: number; reason: string }[] = [];

  repaired.rows.forEach((row, idx) => {
    const lineNumber = idx + 2; // header is line 1
    const id = pick(row, CONTACT_HEADERS.id) || String(lineNumber);

    let name = pick(row, CONTACT_HEADERS.name);
    if (!name) {
      const firstName = pick(row, CONTACT_HEADERS.firstName);
      const lastName = pick(row, CONTACT_HEADERS.lastName);
      name = [firstName, lastName].filter(Boolean).join(' ').trim();
    }
    if (!name) {
      errors.push({ line: lineNumber, reason: 'Nom manquant' });
      return;
    }

    const rawAddress = pick(row, CONTACT_HEADERS.address);
    const explicitCity = pick(row, CONTACT_HEADERS.city);
    const explicitPostalCode = pick(row, CONTACT_HEADERS.postalCode);
    const split = explicitCity || explicitPostalCode
      ? { address: rawAddress, postal_code: explicitPostalCode, city: explicitCity }
      : splitAddress(rawAddress);

    rows.push({
      externalId: id,
      name,
      email: pick(row, CONTACT_HEADERS.email),
      phone: normalizePhone(pick(row, CONTACT_HEADERS.phone)),
      address: split.address,
      city: split.city,
      postal_code: split.postal_code,
      notes: pick(row, CONTACT_HEADERS.notes),
      contact_type: mapContactType(
        pick(row, CONTACT_HEADERS.statut),
        pick(row, CONTACT_HEADERS.type),
      ),
    });
  });

  // Aucun avertissement possible sur les contacts : une ligne passe ou échoue.
  return { rows, errors, warnings: [] };
}

const QUOTE_HEADERS = {
  id: ['ID', 'Identifiant'],
  number: ['Numero', 'Numéro', 'Number', 'No', 'N°'],
  status: ['Statut', 'Status', 'Etat', 'État'],
  client: ['Client', 'Customer', 'Contact'],
  title: ['Chantier', 'Titre', 'Title', 'Objet', 'Designation', 'Désignation'],
  description: ['Description', 'Note', 'Notes'],
  totalHt: ['Total HT', 'Montant HT', 'HT'],
  totalTtc: ['Total TTC', 'Montant TTC', 'TTC'],
  tva: ['TVA', 'Taux TVA', 'VAT'],
  issuedAt: ["Date d'emission", "Date d'émission", 'Date emission', 'Date'],
  validUntil: ["Date d'expiration", 'Date expiration', 'Validite', 'Valid until'],
};

export function mapQuotesCSV(parsed: ParsedCSV): ImportSummary<MappedQuote> {
  const repaired = repairParsedCsv(parsed);
  const rows: MappedQuote[] = [];
  const errors: { line: number; reason: string }[] = [];

  repaired.rows.forEach((row, idx) => {
    const lineNumber = idx + 2;
    const number = pick(row, QUOTE_HEADERS.number);
    const clientName = pick(row, QUOTE_HEADERS.client);
    if (!number) {
      errors.push({ line: lineNumber, reason: 'Numéro de devis manquant' });
      return;
    }
    if (!clientName) {
      errors.push({ line: lineNumber, reason: 'Client manquant' });
      return;
    }
    const totalHt = parseFrenchNumber(pick(row, QUOTE_HEADERS.totalHt));
    const totalTtc = parseFrenchNumber(pick(row, QUOTE_HEADERS.totalTtc));
    const tvaRaw = pick(row, QUOTE_HEADERS.tva);
    const tvaParsed = parseFrenchNumber(tvaRaw);
    // If TVA is stored as a euro amount (e.g. 1234), derive the rate from totals
    const tvaRate =
      tvaParsed > 0 && tvaParsed <= 50
        ? tvaParsed
        : totalHt > 0
          ? Math.round(((totalTtc - totalHt) / totalHt) * 100)
          : 20;

    rows.push({
      externalId: pick(row, QUOTE_HEADERS.id) || String(lineNumber),
      source_number: number,
      client_name: clientName,
      title: pick(row, QUOTE_HEADERS.title) || `Devis ${number}`,
      description: pick(row, QUOTE_HEADERS.description),
      status: mapQuoteStatus(pick(row, QUOTE_HEADERS.status)),
      total_ht: totalHt,
      tva_rate: tvaRate,
      total_ttc: totalTtc || totalHt * (1 + tvaRate / 100),
      issued_at: parseFrenchDate(pick(row, QUOTE_HEADERS.issuedAt)),
      valid_until: parseFrenchDate(pick(row, QUOTE_HEADERS.validUntil)),
    });
  });

  return { rows, errors, warnings: [] };
}

const INVOICE_HEADERS = {
  id: ['ID', 'Identifiant'],
  number: ['Numero', 'Numéro', 'Number', 'No', 'N°'],
  type: ['Type'],
  status: ['Statut', 'Status', 'Etat', 'État'],
  client: ['Client', 'Customer', 'Contact'],
  title: ['Chantier', 'Titre', 'Title', 'Objet', 'Designation', 'Désignation'],
  totalHt: ['Total HT', 'Montant HT', 'HT'],
  totalTtc: ['Total TTC', 'Montant TTC', 'TTC'],
  tva: ['TVA', 'Taux TVA', 'VAT'],
  issuedAt: ["Date d'emission", "Date d'émission", 'Date emission', 'Date'],
  dueDate: ['Date echeance', "Date d'échéance", 'Echeance', 'Due date'],
  paidAt: ['Date de paiement', 'Date paiement', 'Paid at', 'Date reglement'],
  quoteRef: ['Devis', 'Quote', 'Devis lie'],
  notes: ['Commentaire', 'Comment', 'Notes', 'Note', 'Observations', 'Libelle', 'Libellé'],
  // Colonne portant le numéro de la facture rectifiée par un avoir. Tous les
  // candidats sont volontairement composés de plusieurs mots : « Facture »
  // seul serait attrapé par la recherche par sous-chaîne de `pick()` et
  // renverrait le numéro de la ligne elle-même.
  creditedRef: [
    "Facture d'origine",
    'Facture origine',
    'Facture rectifiee',
    'Facture rectifiée',
    'Facture initiale',
    'Facture liee',
    'Facture liée',
    'Facture creditee',
    'Facture créditée',
    'Facture de reference',
    'Facture de référence',
    'Reference facture',
    'Référence facture',
    'Avoir sur facture',
    'Avoir sur',
    "Document d'origine",
    'Document origine',
    "Piece d'origine",
    "Pièce d'origine",
    'Original invoice',
    'Credited invoice',
    'Related invoice',
    'Invoice ref',
  ],
  reason: [
    "Motif de l'avoir",
    'Motif avoir',
    'Motif',
    'Raison',
    'Cause',
    'Reason',
  ],
};

// ── Services / bibliothèque de prix ──────────────────────────────────────────

const SERVICE_HEADERS = {
  id: ['ID', 'Identifiant', 'Code', 'Reference', 'Référence'],
  name: ['Nom', 'Libelle', 'Libellé', 'Designation', 'Désignation', 'Name', 'Title', 'Titre'],
  description: ['Description', 'Detail', 'Détail', 'Notes', 'Note'],
  unit: ['Unite', 'Unité', 'Unit', 'U'],
  unitPrice: ['Prix unitaire', 'Prix HT', 'PU HT', 'PU', 'Prix', 'Price', 'Tarif'],
  category: ['Categorie', 'Catégorie', 'Famille', 'Category', 'Type', 'Groupe'],
  tva: ['TVA', 'Taux TVA', 'VAT', 'Taux'],
};

/**
 * Normalize a free-form unit string into one of the canonical UNITS keys we use
 * in the prestations form. Falls back to the trimmed string itself when no
 * obvious mapping is found — the user can fix it from the prestations page.
 */
function normalizeUnit(value: string): string {
  if (!value) return 'u';
  const v = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (v === 'u' || v === 'unite' || v === 'unit' || v === 'piece' || v === 'pce') return 'u';
  if (v === 'h' || v === 'heure' || v === 'hour' || v === 'hr') return 'h';
  if (v === 'm2' || v === 'metrecarre' || v === 'mcarre' || v === 'mq') return 'm2';
  if (v === 'ml' || v === 'metrelineaire' || v === 'metrelinear') return 'ml';
  if (v === 'm3' || v === 'metrecube' || v === 'mcube') return 'm3';
  if (v === 'kg' || v === 'kilo' || v === 'kilogramme') return 'kg';
  if (v === 'forfait' || v === 'forf' || v === 'lot' || v === 'ens') return 'forfait';
  if (v === 'jour' || v === 'j' || v === 'day') return 'jour';
  // Unknown unit — keep raw lowercased value, the user can edit it later.
  return value.trim().toLowerCase();
}

export function mapServicesCSV(parsed: ParsedCSV): ImportSummary<MappedService> {
  const repaired = repairParsedCsv(parsed);
  const rows: MappedService[] = [];
  const errors: { line: number; reason: string }[] = [];

  repaired.rows.forEach((row, idx) => {
    const lineNumber = idx + 2;
    const name = pick(row, SERVICE_HEADERS.name);
    if (!name) {
      errors.push({ line: lineNumber, reason: 'Nom de la prestation manquant' });
      return;
    }
    const tvaRaw = pick(row, SERVICE_HEADERS.tva);
    const tvaParsed = parseFrenchNumber(tvaRaw);
    const tvaRate = tvaParsed > 0 && tvaParsed <= 50 ? tvaParsed : 20;

    rows.push({
      externalId: pick(row, SERVICE_HEADERS.id) || String(lineNumber),
      name,
      description: pick(row, SERVICE_HEADERS.description),
      unit: normalizeUnit(pick(row, SERVICE_HEADERS.unit)),
      unit_price: parseFrenchNumber(pick(row, SERVICE_HEADERS.unitPrice)),
      category: pick(row, SERVICE_HEADERS.category),
      tva_rate: tvaRate,
    });
  });

  return { rows, errors, warnings: [] };
}

// ── Avoirs (factures rectificatives) ─────────────────────────────────────────

/**
 * Les logiciels concurrents exportent leurs avoirs dans le même fichier que
 * leurs factures, avec des conventions qui varient d'un éditeur à l'autre :
 * colonne « Type » valant « Avoir », numéro préfixé AV, montants négatifs, ou
 * simplement « Avoir sur facture 2024-012 » dans le libellé. On reconnaît tous
 * ces cas.
 *
 * Aplatir un avoir en facture annulée — ce que faisait cet import — perd à la
 * fois la déduction de chiffre d'affaires et la régularisation de TVA
 * (art. 272-1 CGI) : l'artisan repartait avec une comptabilité fausse.
 */

/** Retire les accents en conservant la casse — une référence garde la sienne. */
function flattenAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Minuscules, sans accents, espaces normalisés — pour les comparaisons. */
function normalizeText(value: string): string {
  return flattenAccents(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Mots qui désignent un avoir dans un export (français, anglais, allemand). */
const CREDIT_NOTE_WORDS = /avoir|credit ?note|note de credit|gutschrift|nota de credito/;

/**
 * Numéro qui trahit un avoir : notre propre série (AV-2026-001) comme les
 * conventions des concurrents (AV2024-12, AVR-7, AVOIR 15).
 */
const CREDIT_NOTE_NUMBER = new RegExp(
  `^(?:${CREDIT_NOTE_PREFIX}[a-z]?[-_\\s./]?\\d|avoir)`,
  'i',
);

/**
 * « Avoir » est aussi un verbe très courant : dans un libellé libre, on ne le
 * retient qu'en position de document (« Avoir n° 12 », « Avoir sur facture
 * 2024-03 »), jamais au milieu d'une phrase.
 */
const CREDIT_NOTE_IN_LABEL = /^avoir\b|\bavoir (?:n[°o]|sur|s\/|facture|de facture)/;

function detectCreditNote(params: {
  number: string;
  type: string;
  status: string;
  title: string;
  notes: string;
  totalHt: number;
  totalTtc: number;
}): boolean {
  // Des montants négatifs signent un crédit, quoi que dise le reste du
  // fichier — et la base refuse de toute façon une facture non-avoir négative.
  if (params.totalHt < 0 || params.totalTtc < 0) return true;
  if (CREDIT_NOTE_WORDS.test(normalizeText(params.type))) return true;
  if (CREDIT_NOTE_WORDS.test(normalizeText(params.status))) return true;
  if (CREDIT_NOTE_NUMBER.test(params.number.trim())) return true;
  if (CREDIT_NOTE_IN_LABEL.test(normalizeText(params.title))) return true;
  if (CREDIT_NOTE_IN_LABEL.test(normalizeText(params.notes))) return true;
  return false;
}

/**
 * « Facture d'origine n° F-2024-012 », « Avoir sur facture 2024/03 »… La
 * référence capturée doit contenir au moins un chiffre, sinon ce n'est pas un
 * numéro de document.
 */
const CREDITED_REF_IN_TEXT = new RegExp(
  '\\b(?:factures?|fact|fac|invoices?|inv|piece|document)' +
    "(?:\\s*(?:d['\u2019]\\s*origine|origine|rectifiee|rectifie|initiale|liee|lie|" +
    'creditee|credite|de reference|reference|n[\u00b0\u00bao]|numero|num|no|#|:|-|\\.)\\s*)*' +
    '\\s*([A-Za-z]{0,4}[-_/.]?\\d[A-Za-z0-9._/-]*)',
  'i',
);

/** Comparaison de références, insensible à la casse et à la ponctuation. */
function sameRef(a: string, b: string): boolean {
  const flat = (v: string) =>
    flattenAccents(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const left = flat(a);
  return left.length > 0 && left === flat(b);
}

function isPlausibleDocumentRef(ref: string, ownNumber: string): boolean {
  if (ref.length < 2) return false;
  if (!/\d/.test(ref)) return false;
  // Une date n'est pas une référence de document.
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(ref)) return false;
  // Une ligne ne se crédite pas elle-même.
  if (sameRef(ref, ownNumber)) return false;
  return true;
}

function matchCreditedRefInText(text: string, ownNumber: string): string {
  if (!text) return '';
  const matched = flattenAccents(text).match(CREDITED_REF_IN_TEXT);
  if (!matched) return '';
  const ref = matched[1].replace(/[\s:;,.]+$/, '');
  return isPlausibleDocumentRef(ref, ownNumber) ? ref : '';
}

/**
 * Numéro de la facture rectifiée : colonne dédiée d'abord, puis, à défaut,
 * extraction depuis les libellés — beaucoup d'exports n'ont pas de colonne et
 * se contentent d'un « Avoir sur facture 2024-012 » en texte libre.
 */
function findCreditedRef(
  row: Record<string, string>,
  ownNumber: string,
  freeTexts: string[],
): string {
  const cell = pick(row, INVOICE_HEADERS.creditedRef);
  if (cell) {
    const bare = flattenAccents(cell)
      .trim()
      .replace(/^[\s:#.-]+/, '')
      .replace(/[\s:;,.]+$/, '');
    if (bare && !/\s/.test(bare) && isPlausibleDocumentRef(bare, ownNumber)) {
      return bare;
    }
    const fromCell = matchCreditedRefInText(cell, ownNumber);
    if (fromCell) return fromCell;
  }
  for (const text of freeTexts) {
    const found = matchCreditedRefInText(text, ownNumber);
    if (found) return found;
  }
  return '';
}

/** Rattachement d'un motif libre aux `CREDIT_REASONS` de l'app. */
const CREDIT_REASON_KEYWORDS: Array<{ value: string; pattern: RegExp }> = [
  { value: 'erreur_facturation', pattern: /erreur|correction|mauvais montant|double facturation/ },
  { value: 'geste_commercial', pattern: /geste|remise|ristourne|rabais|commercial/ },
  { value: 'annulation', pattern: /annul|resiliation|desistement/ },
  { value: 'travaux_non_realises', pattern: /non realis|non effectu|non execut|travaux abandonn|chantier abandonn/ },
  { value: 'retour_materiel', pattern: /retour|reprise (?:de )?materiel|marchandise/ },
  { value: 'litige', pattern: /litige|reclamation|contentieux|malfacon|\bsav\b/ },
];

/**
 * Rattache un motif libre à l'un des `CREDIT_REASONS`. Renvoie `null` plutôt
 * que d'inventer : pas de motif vaut mieux qu'un motif faux.
 */
function matchKnownCreditReason(raw: string): string | null {
  const text = normalizeText(raw);
  if (!text) return null;
  for (const reason of CREDIT_REASONS) {
    if (text === reason.value || text === normalizeText(reason.label)) {
      return reason.value;
    }
  }
  for (const { value, pattern } of CREDIT_REASON_KEYWORDS) {
    if (pattern.test(text)) return value;
  }
  return null;
}

const MAX_CREDIT_REASON_LENGTH = 200;

/**
 * Motif de l'avoir : la colonne dédiée si elle existe (normalisée quand elle
 * correspond à un motif connu, sinon reprise telle quelle), à défaut un motif
 * reconnaissable dans les libellés. On ne recopie jamais un libellé entier
 * dans le motif.
 */
function normalizeCreditReason(raw: string, fallbackText: string): string | null {
  const known = matchKnownCreditReason(raw);
  if (known) return known;
  const free = raw.trim();
  if (free) {
    return free.length > MAX_CREDIT_REASON_LENGTH
      ? `${free.slice(0, MAX_CREDIT_REASON_LENGTH - 3).trimEnd()}...`
      : free;
  }
  return matchKnownCreditReason(fallbackText);
}

/** Pourquoi un avoir n'a pas pu être importé en tant que tel. */
export type CreditNoteFallbackCause =
  | 'reference_absente'
  | 'facture_introuvable'
  | 'facture_non_creditable';

function buildCreditNoteFallbackWarning(
  row: MappedInvoice,
  cause: CreditNoteFallbackCause,
): ImportWarning {
  const prefix = `Avoir « ${row.source_number} » importé comme facture annulée`;
  const ref = row.credited_source_number;
  switch (cause) {
    case 'facture_introuvable':
      return {
        line: row.line,
        reason: `${prefix} : la facture d'origine « ${ref} » est introuvable dans Hellobat.`,
        hint: "Importez d'abord cette facture, puis créez l'avoir depuis sa fiche.",
      };
    case 'facture_non_creditable':
      return {
        line: row.line,
        reason: `${prefix} : la facture d'origine « ${ref} » ne peut pas être créditée (brouillon, avoir, ou autre compte).`,
        hint: "Un avoir ne rectifie qu'une facture déjà émise de votre compte.",
      };
    case 'reference_absente':
    default:
      return {
        line: row.line,
        reason: `${prefix} : aucune facture d'origine n'est indiquée dans le fichier.`,
        hint: "Ajoutez une colonne « Facture d'origine » contenant le numéro de la facture rectifiée, puis réimportez cette ligne.",
      };
  }
}

/**
 * Rétrograde un avoir en facture annulée — le comportement historique de cet
 * import.
 *
 * La base impose qu'un avoir référence une facture émise du même compte
 * (trigger `validate_credit_note`). Sans référence résolvable, l'insertion
 * échouerait et l'artisan perdrait purement et simplement la ligne : on
 * préfère importer une facture annulée, à montant positif, et le lui dire
 * dans le rapport d'import. Il pourra émettre le vrai avoir depuis la fiche
 * facture une fois celle-ci présente.
 *
 * À appeler aussi côté route, quand la référence existe mais ne se résout pas
 * en `credited_invoice_id` — plutôt que de laisser partir un INSERT qui sera
 * rejeté par la base.
 *
 * La ligne rétrogradée ne crée toujours pas de chantier : c'est un avoir, pas
 * un travail vendu.
 */
export function fallbackCreditNoteToCancelled(
  row: MappedInvoice,
  cause: CreditNoteFallbackCause,
): { row: MappedInvoice; warning: ImportWarning } {
  const warning = buildCreditNoteFallbackWarning(row, cause);
  if (!isCreditNote(row)) return { row, warning };
  return {
    row: {
      ...row,
      invoice_type: 'standard',
      status: 'annulee',
      // `credited_invoice_id` est interdit hors avoir : on efface la référence
      // pour qu'aucune route ne tente de la poser.
      credited_source_number: '',
      creates_project: false,
      total_ht: Math.abs(row.total_ht),
      total_tva: Math.abs(row.total_tva),
      total_ttc: Math.abs(row.total_ttc),
      due_date: null,
      paid_at: null,
    },
    warning,
  };
}

export function mapInvoicesCSV(parsed: ParsedCSV): ImportSummary<MappedInvoice> {
  const repaired = repairParsedCsv(parsed);
  const rows: MappedInvoice[] = [];
  const errors: { line: number; reason: string }[] = [];
  const warnings: ImportWarning[] = [];

  repaired.rows.forEach((row, idx) => {
    const lineNumber = idx + 2;
    const number = pick(row, INVOICE_HEADERS.number);
    const clientName = pick(row, INVOICE_HEADERS.client);
    if (!number) {
      errors.push({ line: lineNumber, reason: 'Numéro de facture manquant' });
      return;
    }
    if (!clientName) {
      errors.push({ line: lineNumber, reason: 'Client manquant' });
      return;
    }

    const totalHt = parseFrenchNumber(pick(row, INVOICE_HEADERS.totalHt));
    const totalTtc = parseFrenchNumber(pick(row, INVOICE_HEADERS.totalTtc));
    const tvaParsed = parseFrenchNumber(pick(row, INVOICE_HEADERS.tva));
    const tvaRate = deriveTvaRate(tvaParsed, totalHt, totalTtc);

    const typeStr = pick(row, INVOICE_HEADERS.type);
    const statusStr = pick(row, INVOICE_HEADERS.status);
    const rawTitle = pick(row, INVOICE_HEADERS.title);
    const notes = pick(row, INVOICE_HEADERS.notes);
    const externalId = pick(row, INVOICE_HEADERS.id) || String(lineNumber);
    const issuedAt = parseFrenchDate(pick(row, INVOICE_HEADERS.issuedAt));

    const looksLikeCreditNote = detectCreditNote({
      number,
      type: typeStr,
      status: statusStr,
      title: rawTitle,
      notes,
      totalHt,
      totalTtc,
    });

    if (!looksLikeCreditNote) {
      const computedTtc = totalTtc || totalHt * (1 + tvaRate / 100);
      rows.push({
        externalId,
        line: lineNumber,
        source_number: number,
        source_quote_number: pick(row, INVOICE_HEADERS.quoteRef),
        client_name: clientName,
        title: rawTitle || `Facture ${number}`,
        status: mapInvoiceStatus(statusStr),
        invoice_type: 'standard',
        credited_source_number: '',
        credit_reason: null,
        creates_project: true,
        total_ht: totalHt,
        total_tva: Math.max(0, round2(computedTtc - totalHt)),
        tva_rate: tvaRate,
        total_ttc: computedTtc,
        issued_at: issuedAt,
        due_date: parseFrenchDate(pick(row, INVOICE_HEADERS.dueDate)),
        paid_at: parseFrenchDate(pick(row, INVOICE_HEADERS.paidAt)),
      });
      return;
    }

    // Montants stockés négatifs, quelle que soit la convention du fichier
    // source : certains exportent la valeur absolue avec un type « Avoir »,
    // d'autres exportent déjà des négatifs.
    const amountHt = Math.abs(totalHt);
    const amountTtc = Math.abs(totalTtc) || round2(amountHt * (1 + tvaRate / 100));

    const creditNote: MappedInvoice = {
      externalId,
      line: lineNumber,
      source_number: number,
      // Un avoir ne se rattache pas à un devis : le lier ferait croire au
      // devis qu'il a été facturé une fois de plus.
      source_quote_number: '',
      client_name: clientName,
      title: rawTitle || `Avoir ${number}`,
      status: mapCreditNoteStatus(statusStr),
      invoice_type: 'avoir',
      credited_source_number: findCreditedRef(row, number, [
        rawTitle,
        notes,
        typeStr,
        statusStr,
      ]),
      credit_reason: normalizeCreditReason(
        pick(row, INVOICE_HEADERS.reason),
        `${typeStr} ${rawTitle} ${notes}`,
      ),
      // Un avoir ne vend rien : pas de chantier, et surtout pas de chantier au
      // budget négatif.
      creates_project: false,
      total_ht: -amountHt,
      total_tva: -Math.max(0, round2(amountTtc - amountHt)),
      tva_rate: tvaRate,
      total_ttc: -amountTtc,
      issued_at: issuedAt,
      // Ni échéance ni encaissement : un avoir n'est pas payable.
      due_date: null,
      paid_at: null,
    };

    if (!creditNote.credited_source_number) {
      const fallback = fallbackCreditNoteToCancelled(creditNote, 'reference_absente');
      warnings.push(fallback.warning);
      rows.push(fallback.row);
      return;
    }

    rows.push(creditNote);
  });

  return { rows, errors, warnings };
}
