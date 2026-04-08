// Parser CSV multi-banques françaises
// Supporte BNP, Société Générale, Crédit Agricole, Crédit Mutuel, LCL,
// Qonto, Shine, Boursorama, Revolut, Hello Bank, Monabanq, etc.
//
// Heuristique :
// 1. Détecte le séparateur (`;` ou `,` ou `\t`)
// 2. Trouve la ligne d'en-tête (celle qui contient "date" + un mot type "libell"/"montant")
// 3. Identifie les colonnes par mots-clés
// 4. Lit les lignes en respectant les guillemets

import type { ParsedStatement, ParsedTransaction } from './index';

interface ColumnIndices {
  date: number;
  valueDate: number;
  label: number;
  amount: number;
  debit: number;
  credit: number;
}

const HEADER_KEYWORDS = {
  date: ['date opération', 'date op', 'date', 'date comptable', 'date transaction'],
  valueDate: ['date valeur', 'valeur', 'value date'],
  label: ['libellé', 'libelle', 'description', 'wording', 'détail', 'detail', 'objet', 'nature opération'],
  amount: ['montant', 'amount'],
  debit: ['débit', 'debit'],
  credit: ['crédit', 'credit'],
};

export function parseCsv(content: string): ParsedStatement {
  // Strip BOM
  let text = content;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('Fichier CSV vide');
  }

  // Détecte le séparateur sur les 5 premières lignes
  const separator = detectSeparator(lines.slice(0, 10));

  // Trouve la ligne d'en-tête : la première qui contient un mot-clé "date" et un mot-clé "libellé"/"montant"
  let headerIdx = -1;
  let columns: ColumnIndices | null = null;

  for (let i = 0; i < Math.min(lines.length, 30); i += 1) {
    const cells = parseCsvLine(lines[i], separator).map((c) => normalizeHeader(c));
    const idx = mapColumns(cells);
    if (idx.date !== -1 && (idx.label !== -1 || idx.amount !== -1 || idx.debit !== -1)) {
      headerIdx = i;
      columns = idx;
      break;
    }
  }

  if (headerIdx === -1 || !columns) {
    throw new Error(
      'Impossible de détecter les colonnes du CSV. Vérifiez que le fichier contient bien une ligne d\'en-tête avec "Date", "Libellé" et "Montant" (ou "Débit"/"Crédit").',
    );
  }

  // Cherche un en-tête bancaire dans les premières lignes (avant l'en-tête)
  let bankName = '';
  let accountIban = '';
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;

  for (let i = 0; i < headerIdx; i += 1) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (lower.includes('iban') || /[A-Z]{2}\d{2}[A-Z0-9 ]{20,}/i.test(line)) {
      const m = line.match(/[A-Z]{2}\d{2}[A-Z0-9 ]{20,}/i);
      if (m) accountIban = m[0].replace(/\s+/g, '').slice(0, 34);
    }
    if (lower.includes('solde') && lower.includes('ouverture')) {
      const num = extractAmount(line);
      if (num != null) openingBalance = num;
    }
    if (lower.includes('solde') && (lower.includes('clôture') || lower.includes('cloture') || lower.includes('final'))) {
      const num = extractAmount(line);
      if (num != null) closingBalance = num;
    }
    // Bank name heuristic : ligne contenant un mot-clé connu
    if (!bankName) {
      const banks = ['bnp', 'société générale', 'societe generale', 'crédit agricole', 'credit agricole', 'crédit mutuel', 'credit mutuel', 'lcl', 'qonto', 'shine', 'boursorama', 'hello bank', 'monabanq', 'caisse d\'épargne', 'banque populaire', 'revolut', 'fortuneo'];
      for (const b of banks) {
        if (lower.includes(b)) {
          bankName = b.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          break;
        }
      }
    }
  }

  // Parse les lignes de transactions
  const transactions: ParsedTransaction[] = [];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i], separator);
    if (cells.length < 2) continue;

    const dateStr = cells[columns.date];
    if (!dateStr) continue;

    const txDate = parseFrenchDate(dateStr);
    if (!txDate) continue;

    const valueDate =
      columns.valueDate !== -1 && cells[columns.valueDate]
        ? parseFrenchDate(cells[columns.valueDate])
        : null;

    const label =
      columns.label !== -1 && cells[columns.label]
        ? cells[columns.label].trim()
        : '';

    let amount: number | null = null;

    // Cas 1 : colonne montant unique (signé)
    if (columns.amount !== -1) {
      amount = parseFrenchNumber(cells[columns.amount]);
    }

    // Cas 2 : colonnes débit + crédit séparées
    if (amount == null && (columns.debit !== -1 || columns.credit !== -1)) {
      const debit =
        columns.debit !== -1 ? parseFrenchNumber(cells[columns.debit]) : null;
      const credit =
        columns.credit !== -1 ? parseFrenchNumber(cells[columns.credit]) : null;
      if (debit != null && debit !== 0) {
        amount = -Math.abs(debit);
      } else if (credit != null && credit !== 0) {
        amount = Math.abs(credit);
      }
    }

    if (amount == null || isNaN(amount)) continue;
    if (!label) continue;

    transactions.push({
      transaction_date: txDate,
      value_date: valueDate,
      label,
      amount: +amount.toFixed(2),
      direction: amount >= 0 ? 'credit' : 'debit',
      fitid: null,
    });

    if (!periodStart || txDate < periodStart) periodStart = txDate;
    if (!periodEnd || txDate > periodEnd) periodEnd = txDate;
  }

  if (transactions.length === 0) {
    throw new Error('Aucune transaction lisible trouvée dans le CSV.');
  }

  return {
    format: 'csv',
    bank_name: bankName,
    account_iban: accountIban,
    period_start: periodStart,
    period_end: periodEnd,
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    transactions,
  };
}

// ───────────────────────── Helpers ─────────────────────────

function detectSeparator(lines: string[]): string {
  const candidates = [';', ',', '\t', '|'];
  let best = ';';
  let bestScore = -1;
  for (const sep of candidates) {
    const counts = lines.map((l) => (l.match(new RegExp(escapeRegex(sep), 'g')) || []).length);
    if (counts.length === 0) continue;
    const max = Math.max(...counts);
    const min = Math.min(...counts.filter((c) => c > 0).concat([max]));
    // On veut beaucoup d'occurrences ET stable d'une ligne à l'autre
    if (max >= 2 && min >= 1 && max - min <= 2) {
      const score = max * 10 - (max - min);
      if (score > bestScore) {
        bestScore = score;
        best = sep;
      }
    }
  }
  return best;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === separator && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/^["']+|["']+$/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function mapColumns(cells: string[]): ColumnIndices {
  const idx: ColumnIndices = { date: -1, valueDate: -1, label: -1, amount: -1, debit: -1, credit: -1 };

  for (let i = 0; i < cells.length; i += 1) {
    const c = cells[i];
    if (idx.valueDate === -1 && HEADER_KEYWORDS.valueDate.some((kw) => c.includes(removeAccents(kw)))) {
      idx.valueDate = i;
      continue;
    }
    if (idx.date === -1 && HEADER_KEYWORDS.date.some((kw) => c === removeAccents(kw) || c.includes(removeAccents(kw)))) {
      idx.date = i;
      continue;
    }
    if (idx.debit === -1 && HEADER_KEYWORDS.debit.some((kw) => c.includes(removeAccents(kw)))) {
      idx.debit = i;
      continue;
    }
    if (idx.credit === -1 && HEADER_KEYWORDS.credit.some((kw) => c.includes(removeAccents(kw)))) {
      idx.credit = i;
      continue;
    }
    if (idx.amount === -1 && HEADER_KEYWORDS.amount.some((kw) => c.includes(removeAccents(kw)))) {
      idx.amount = i;
      continue;
    }
    if (idx.label === -1 && HEADER_KEYWORDS.label.some((kw) => c.includes(removeAccents(kw)))) {
      idx.label = i;
      continue;
    }
  }

  return idx;
}

function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseFrenchDate(input: string): string | null {
  if (!input) return null;
  const s = input.trim().replace(/^["']+|["']+$/g, '');
  if (!s) return null;

  // ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD/MM/YYYY ou DD/MM/YY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    let year = m[3];
    if (year.length === 2) {
      const yn = parseInt(year, 10);
      year = (yn > 50 ? '19' : '20') + year;
    }
    return `${year}-${month}-${day}`;
  }

  // DD-MM-YYYY ou DD.MM.YYYY
  m = s.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{2,4})/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    let year = m[3];
    if (year.length === 2) {
      const yn = parseInt(year, 10);
      year = (yn > 50 ? '19' : '20') + year;
    }
    return `${year}-${month}-${day}`;
  }

  return null;
}

function parseFrenchNumber(input: string | undefined): number | null {
  if (input == null) return null;
  let s = String(input).trim().replace(/^["']+|["']+$/g, '');
  if (!s || s === '-' || s === '0,00' || s === '0.00') return s === '0,00' || s === '0.00' ? 0 : null;

  // Retire le symbole € et espaces (séparateur de milliers)
  s = s.replace(/€/g, '').replace(/\s/g, '').replace(/\u00a0/g, '');

  // Si format français (virgule décimale) : "1.234,56" → "1234.56"
  if (s.includes(',') && s.includes('.')) {
    // Décimal = virgule
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function extractAmount(line: string): number | null {
  const m = line.match(/(-?\d{1,3}(?:[\s.]\d{3})*(?:[,.]\d{1,2})?)\s*€?/);
  if (!m) return null;
  return parseFrenchNumber(m[1]);
}
