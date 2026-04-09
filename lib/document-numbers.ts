/**
 * Per-user sequential document numbers.
 *
 * French accounting law (and common sense) requires that each business
 * maintains its own gapless, ordered numbering for quotes and invoices —
 * each artisan must see D-2026-001, D-2026-002, D-2026-003, … regardless
 * of what other artisans on the platform are doing.
 *
 * The DB enforces UNIQUE(user_id, quote_number) and UNIQUE(user_id,
 * invoice_number). These helpers compute the next suffix by looking at
 * the user's existing rows for the current year. Callers should retry on
 * a 23505 unique-violation if two concurrent inserts race (rare in
 * practice — same user, same second).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type DocumentTable = 'quotes' | 'invoices';
export type DocumentPrefix = 'D' | 'F';

interface NextNumberOptions {
  supabase: SupabaseClient;
  table: DocumentTable;
  column: 'quote_number' | 'invoice_number';
  prefix: DocumentPrefix;
  userId: string;
  year?: number;
}

/**
 * Returns the next document number for a user in a given year.
 * Format: `{prefix}-{year}-{NNN}` (3-digit zero-padded suffix that grows
 * with a 4th digit if the user ever goes past 999 in a year).
 */
export async function getNextDocumentNumber({
  supabase,
  table,
  column,
  prefix,
  userId,
  year = new Date().getFullYear(),
}: NextNumberOptions): Promise<string> {
  const yearPrefix = `${prefix}-${year}-`;
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq('user_id', userId)
    .like(column, `${yearPrefix}%`);

  if (error) {
    // Fail safe: start at 001 rather than throw; the unique constraint
    // will catch a real collision and the caller can retry.
    return `${yearPrefix}${'001'}`;
  }

  let max = 0;
  for (const row of (data as Array<Record<string, string | null>>) || []) {
    const value = row[column];
    if (!value || !value.startsWith(yearPrefix)) continue;
    const suffix = value.slice(yearPrefix.length);
    // Accept any row that starts with digits — covers legacy `D-2026-091`
    // style as well as odder historical formats.
    const match = suffix.match(/^(\d+)/);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (Number.isFinite(num) && num > max) max = num;
  }

  const next = max + 1;
  const padded = next < 1000 ? String(next).padStart(3, '0') : String(next);
  return `${yearPrefix}${padded}`;
}

/**
 * Thin wrappers so callers don't have to remember the column / prefix
 * pairing.
 */
export function getNextQuoteNumber(
  supabase: SupabaseClient,
  userId: string,
  year?: number,
): Promise<string> {
  return getNextDocumentNumber({
    supabase,
    table: 'quotes',
    column: 'quote_number',
    prefix: 'D',
    userId,
    year,
  });
}

export function getNextInvoiceNumber(
  supabase: SupabaseClient,
  userId: string,
  year?: number,
): Promise<string> {
  return getNextDocumentNumber({
    supabase,
    table: 'invoices',
    column: 'invoice_number',
    prefix: 'F',
    userId,
    year,
  });
}
