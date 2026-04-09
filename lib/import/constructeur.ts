/**
 * Constructeur (and generic CSV) mapper for the Hellobat import flow.
 *
 * This module turns the CSV exports from Constructeur — and any other software
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
 */

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
  source_number: string;
  source_quote_number: string; // empty if none
  client_name: string;
  title: string;
  status: InvoiceStatus;
  total_ht: number;
  tva_rate: number;
  total_ttc: number;
  issued_at: string | null;
  due_date: string | null;
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

export interface ImportSummary<T> {
  rows: T[];
  errors: { line: number; reason: string }[];
}

// ── Mojibake repair ──────────────────────────────────────────────────────────

/**
 * Repair the most common French mojibake patterns. Constructeur, Excel/Windows
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
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/[€$£]/g, '')
    .replace(/,/g, '.');
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
  return Number.isFinite(n) ? n : 0;
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
  // Constructeur sometimes packs multiple addresses with a newline separator —
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
  if (s.includes('annul') || s.includes('avoir') || s.includes('cancel')) return 'annulee';
  if (s.includes('paye') || s.includes('paid') || s.includes('regle')) return 'payee';
  if (s.includes('retard') || s.includes('overdue')) return 'en_retard';
  if (s.includes('envoy') || s.includes('sent') || s.includes('final')) return 'envoyee';
  if (s.includes('cree') || s.includes('issued')) return 'creee';
  return 'creee';
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

  return { rows, errors };
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

  return { rows, errors };
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

  return { rows, errors };
}

export function mapInvoicesCSV(parsed: ParsedCSV): ImportSummary<MappedInvoice> {
  const repaired = repairParsedCsv(parsed);
  const rows: MappedInvoice[] = [];
  const errors: { line: number; reason: string }[] = [];

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
    const tvaRate =
      tvaParsed > 0 && tvaParsed <= 50
        ? tvaParsed
        : totalHt > 0
          ? Math.round(((totalTtc - totalHt) / totalHt) * 100)
          : 20;

    // "Avoir" → cancelled (annulee). Otherwise honour the status field.
    const typeStr = pick(row, INVOICE_HEADERS.type).toLowerCase();
    const status: InvoiceStatus = typeStr.includes('avoir')
      ? 'annulee'
      : mapInvoiceStatus(pick(row, INVOICE_HEADERS.status));

    rows.push({
      externalId: pick(row, INVOICE_HEADERS.id) || String(lineNumber),
      source_number: number,
      source_quote_number: pick(row, INVOICE_HEADERS.quoteRef),
      client_name: clientName,
      title: pick(row, INVOICE_HEADERS.title) || `Facture ${number}`,
      status,
      total_ht: totalHt,
      tva_rate: tvaRate,
      total_ttc: totalTtc || totalHt * (1 + tvaRate / 100),
      issued_at: parseFrenchDate(pick(row, INVOICE_HEADERS.issuedAt)),
      due_date: parseFrenchDate(pick(row, INVOICE_HEADERS.dueDate)),
      paid_at: parseFrenchDate(pick(row, INVOICE_HEADERS.paidAt)),
    });
  });

  return { rows, errors };
}
