// Détection automatique du format + dispatch vers le bon parser

import { parseCsv } from './csv-parser';
import { parseOfx } from './ofx-parser';

export type BankFormat = 'csv' | 'ofx';

export interface ParsedTransaction {
  transaction_date: string; // YYYY-MM-DD
  value_date: string | null;
  label: string;
  amount: number; // signé : + crédit, - débit
  direction: 'credit' | 'debit';
  fitid: string | null;
}

export interface ParsedStatement {
  format: BankFormat;
  bank_name: string;
  account_iban: string;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  transactions: ParsedTransaction[];
}

export function detectFormat(filename: string, content: string): BankFormat {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.ofx') || lowerName.endsWith('.qfx')) return 'ofx';
  if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) return 'csv';

  // Heuristique sur le contenu : OFX commence par OFXHEADER ou contient <OFX>
  const head = content.slice(0, 500).toUpperCase();
  if (head.includes('OFXHEADER') || head.includes('<OFX>')) return 'ofx';

  return 'csv';
}

export function parseBankStatement(filename: string, content: string): ParsedStatement {
  const format = detectFormat(filename, content);
  if (format === 'ofx') return parseOfx(content);
  return parseCsv(content);
}
