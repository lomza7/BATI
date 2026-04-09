// Liste des banques francaises + helpers IBAN/BIC. Utilisee par le formulaire
// de RIB (combobox) et par l'affichage dans les devis/factures.

export interface BankOption {
  slug: string;
  name: string;
  category: 'traditionnelle' | 'en_ligne' | 'mutualiste' | 'pro';
}

// Triee par nom d'affichage pour un rendu naturel dans la combobox.
// On couvre les 20+ banques qu'on voit le plus souvent chez les artisans.
export const FRENCH_BANKS: BankOption[] = [
  { slug: 'axa-banque', name: 'AXA Banque', category: 'traditionnelle' },
  { slug: 'banque-populaire', name: 'Banque Populaire', category: 'mutualiste' },
  { slug: 'blank', name: 'Blank', category: 'pro' },
  { slug: 'bnp-paribas', name: 'BNP Paribas', category: 'traditionnelle' },
  { slug: 'boursorama', name: 'Boursorama Banque', category: 'en_ligne' },
  { slug: 'bred', name: 'BRED Banque Populaire', category: 'mutualiste' },
  { slug: 'caisse-epargne', name: "Caisse d'Epargne", category: 'mutualiste' },
  { slug: 'cic', name: 'CIC', category: 'traditionnelle' },
  { slug: 'credit-agricole', name: 'Credit Agricole', category: 'mutualiste' },
  { slug: 'credit-cooperatif', name: 'Credit Cooperatif', category: 'mutualiste' },
  { slug: 'credit-du-nord', name: 'Credit du Nord', category: 'traditionnelle' },
  { slug: 'credit-mutuel', name: 'Credit Mutuel', category: 'mutualiste' },
  { slug: 'fortuneo', name: 'Fortuneo', category: 'en_ligne' },
  { slug: 'hello-bank', name: 'Hello bank!', category: 'en_ligne' },
  { slug: 'hsbc', name: 'HSBC France', category: 'traditionnelle' },
  { slug: 'la-banque-postale', name: 'La Banque Postale', category: 'traditionnelle' },
  { slug: 'lcl', name: 'LCL', category: 'traditionnelle' },
  { slug: 'ma-french-bank', name: 'Ma French Bank', category: 'en_ligne' },
  { slug: 'monabanq', name: 'Monabanq', category: 'en_ligne' },
  { slug: 'n26', name: 'N26', category: 'en_ligne' },
  { slug: 'nickel', name: 'Nickel', category: 'en_ligne' },
  { slug: 'orange-bank', name: 'Orange Bank', category: 'en_ligne' },
  { slug: 'qonto', name: 'Qonto', category: 'pro' },
  { slug: 'revolut', name: 'Revolut', category: 'en_ligne' },
  { slug: 'shine', name: 'Shine', category: 'pro' },
  { slug: 'societe-generale', name: 'Societe Generale', category: 'traditionnelle' },
];

export const BANK_CATEGORY_LABELS: Record<BankOption['category'], string> = {
  traditionnelle: 'Banque traditionnelle',
  mutualiste: 'Banque mutualiste',
  en_ligne: 'Banque en ligne',
  pro: 'Banque pro',
};

// ── IBAN helpers ────────────────────────────────────────────────────────────

/** Remove spaces and uppercase. Safe to call on user input. */
export function normalizeIban(value: string): string {
  return (value || '').replace(/\s+/g, '').toUpperCase();
}

/** Format as groups of 4 characters separated by spaces, e.g. "FR76 3000 4028 …". */
export function formatIban(value: string): string {
  const clean = normalizeIban(value);
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Masked IBAN for display: keep the country prefix + check digits and the last
 * four digits, obscure everything in between. Example:
 *   FR76 3000 4028 0000 0404 1234 58 → FR76 •••• •••• •••• •••• 1234 58
 * Returns the formatted original if too short to mask meaningfully.
 */
export function maskIban(value: string): string {
  const clean = normalizeIban(value);
  if (clean.length < 10) return formatIban(clean);
  const head = clean.slice(0, 4);
  const tail = clean.slice(-4);
  const middleLen = clean.length - 8;
  const masked = head + '*'.repeat(middleLen) + tail;
  return formatIban(masked).replace(/\*/g, '•');
}

/**
 * Validate an IBAN using the ISO 13616 mod-97 check. Accepts user input with
 * spaces. Returns true only when the length matches the country's canonical
 * length and the checksum passes.
 */
export function isValidIban(value: string): boolean {
  const clean = normalizeIban(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(clean)) return false;

  const expected = IBAN_LENGTHS[clean.slice(0, 2)];
  if (expected && clean.length !== expected) return false;

  // Move the first 4 chars to the end, then convert letters to numbers
  // (A=10, B=11, …). Reduce mod 97 in chunks to avoid BigInt.
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digit = code >= 65 && code <= 90 ? code - 55 : code - 48;
    if (digit < 0 || digit > 35) return false;
    remainder = (remainder * (digit > 9 ? 100 : 10) + digit) % 97;
  }
  return remainder === 1;
}

/** BIC/SWIFT format: 8 or 11 uppercase alphanumerics, first 6 are letters. */
export function isValidBic(value: string): boolean {
  const clean = (value || '').replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(clean);
}

/** Normalize a BIC the same way we do for the DB. */
export function normalizeBic(value: string): string {
  return (value || '').replace(/\s+/g, '').toUpperCase();
}

// Canonical IBAN lengths per country. Covers the main ones — for the others
// we fall back to the loose `[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}` regex check.
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22,
  BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26,
  IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18,
  NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24,
  SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24,
  TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

export interface BankAccountRow {
  id: string;
  label: string;
  bank_name: string;
  bank_slug: string | null;
  account_holder: string;
  iban: string;
  bic: string;
  is_default: boolean;
  created_at?: string;
}
