/**
 * POST /api/import/costructor/commit
 *
 * Takes the same multipart payload as the preview route, but actually inserts
 * the parsed rows into the user's Supabase tables. Wraps everything in a
 * best-effort transaction-like flow:
 *
 *   1. Insert clients first, build a name → id map.
 *   2. Insert quotes, resolving client names against the new + existing map.
 *   3. Insert invoices, resolving client names AND optionally linking back to
 *      a freshly-imported quote when a `Devis` reference is present.
 *
 * Each step skips entries that fail without aborting the whole import — the
 * user will see how many rows were inserted vs. skipped in the response.
 *
 * Auth: required. Inserts go through an authenticated client so that RLS
 * automatically scopes everything to `auth.uid()`.
 */

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseCSV } from '@/lib/import/csv-parser';
import {
  mapContactsCSV,
  mapQuotesCSV,
  mapInvoicesCSV,
  mapServicesCSV,
  fallbackCreditNoteToCancelled,
  type CreditNoteFallbackCause,
  type ImportWarning,
  type MappedClient,
  type MappedQuote,
  type MappedInvoice,
  type MappedService,
} from '@/lib/import/costructor';
import {
  getNextQuoteNumber,
  getNextInvoiceNumber,
  getNextCreditNoteNumber,
} from '@/lib/document-numbers';
import { CREDITABLE_STATUSES, isCreditNote } from '@/lib/invoices/credit-notes';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function readBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

interface CommitCounts {
  clients: { inserted: number; skipped: number };
  quotes: { inserted: number; skipped: number };
  invoices: { inserted: number; skipped: number };
  services: { inserted: number; skipped: number };
  /**
   * Lignes importées mais dégradées — un avoir rétrogradé en facture annulée
   * faute de facture d'origine résolvable, essentiellement. Sans ce retour,
   * l'artisan ne voyait qu'un compteur « ignorées » muet.
   */
  warnings: ImportWarning[];
}

async function insertClients(
  sb: SupabaseClient,
  userId: string,
  rows: MappedClient[],
  nameMap: Map<string, string>,
  counts: CommitCounts,
): Promise<void> {
  if (rows.length === 0) return;

  // Pre-load existing clients so we don't create duplicates by name.
  const { data: existing } = await sb
    .from('clients')
    .select('id, name')
    .eq('user_id', userId);
  for (const c of existing || []) {
    nameMap.set(normalizeName((c as { name: string }).name), (c as { id: string }).id);
  }

  // Filter out rows that would duplicate an existing client (by normalized name).
  const toInsert: Array<{
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postal_code: string;
    notes: string;
    contact_type: string;
    user_id: string;
  }> = [];

  for (const row of rows) {
    const key = normalizeName(row.name);
    if (nameMap.has(key)) {
      counts.clients.skipped++;
      continue;
    }
    // Reserve the slot — we'll resolve the real id after insert.
    nameMap.set(key, '__pending__');
    toInsert.push({
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      postal_code: row.postal_code,
      notes: row.notes,
      contact_type: row.contact_type,
      user_id: userId,
    });
  }

  if (toInsert.length === 0) return;

  // Chunk inserts (PostgREST hard-caps payload size around 1MB).
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from('clients')
      .insert(chunk)
      .select('id, name');
    if (error) {
      counts.clients.skipped += chunk.length;
      // Roll back the pending markers so subsequent steps don't think these
      // names exist.
      for (const c of chunk) nameMap.delete(normalizeName(c.name));
      continue;
    }
    for (const c of data || []) {
      nameMap.set(
        normalizeName((c as { name: string }).name),
        (c as { id: string }).id,
      );
      counts.clients.inserted++;
    }
  }
}

async function insertQuotes(
  sb: SupabaseClient,
  userId: string,
  rows: MappedQuote[],
  clientMap: Map<string, string>,
  quoteNumberMap: Map<string, string>, // source_number → new id
  counts: CommitCounts,
): Promise<void> {
  if (rows.length === 0) return;

  // Allocate fresh, sequential quote numbers from the user's own series so we
  // never collide with their existing data and the user sees a clean
  // D-YYYY-NNN sequence post-import.
  let next = await getNextQuoteNumber(sb, userId);
  const yearPrefix = next.slice(0, 7); // "D-YYYY-"

  let counter = parseInt(next.slice(yearPrefix.length), 10) || 1;

  for (const row of rows) {
    const clientId = clientMap.get(normalizeName(row.client_name));
    if (!clientId || clientId === '__pending__') {
      counts.quotes.skipped++;
      continue;
    }

    // Try up to 5 distinct numbers in case of a unique-violation race
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const padded =
        counter < 1000 ? String(counter).padStart(3, '0') : String(counter);
      const quoteNumber = `${yearPrefix}${padded}`;
      counter++;

      const payload = {
        quote_number: quoteNumber,
        client_id: clientId,
        title: row.title,
        description: row.description
          ? `${row.description}\n\n— Importé depuis Costructor (${row.source_number})`
          : `Importé depuis Costructor (${row.source_number})`,
        status: row.status,
        total_ht: row.total_ht,
        tva_rate: row.tva_rate,
        total_ttc: row.total_ttc,
        valid_until: row.valid_until,
        user_id: userId,
        // Override created_at when we have an issue date so historical sort works.
        ...(row.issued_at ? { created_at: row.issued_at } : {}),
      };

      const { data, error } = await sb
        .from('quotes')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        if (error.code === '23505') continue; // unique-violation, retry with next number
        counts.quotes.skipped++;
        break;
      }
      if (data) {
        quoteNumberMap.set(row.source_number, (data as { id: string }).id);
        counts.quotes.inserted++;
      }
      inserted = true;
    }
    if (!inserted) counts.quotes.skipped++;
  }
}

async function insertInvoices(
  sb: SupabaseClient,
  userId: string,
  rows: MappedInvoice[],
  clientMap: Map<string, string>,
  quoteNumberMap: Map<string, string>,
  counts: CommitCounts,
): Promise<void> {
  if (rows.length === 0) return;

  let next = await getNextInvoiceNumber(sb, userId);
  const yearPrefix = next.slice(0, 7); // "F-YYYY-"
  let counter = parseInt(next.slice(yearPrefix.length), 10) || 1;

  // Les avoirs prennent leur numéro dans la série dédiée AV-YYYY-NNN : la
  // série des factures doit rester continue (exigence fiscale).
  const creditNoteRows = rows.filter((r) => isCreditNote(r));
  const standardRows = rows.filter((r) => !isCreditNote(r));
  let creditYearPrefix = '';
  let creditCounter = 1;
  if (creditNoteRows.length > 0) {
    const nextCredit = await getNextCreditNoteNumber(sb, userId);
    creditYearPrefix = nextCredit.slice(0, 8); // "AV-YYYY-"
    creditCounter = parseInt(nextCredit.slice(creditYearPrefix.length), 10) || 1;
  }

  // Factures déjà en base : un avoir du fichier peut rectifier une facture
  // importée lors d'un passage précédent. Requête faite uniquement si le
  // fichier contient des avoirs.
  const invoiceByNumber = new Map<
    string,
    { id: string; invoice_type: string | null; status: string | null }
  >();
  if (creditNoteRows.length > 0) {
    const { data: existingInvoices } = await sb
      .from('invoices')
      .select('id, invoice_number, invoice_type, status')
      .eq('user_id', userId);
    for (const inv of existingInvoices || []) {
      const r = inv as { id: string; invoice_number: string | null; invoice_type: string | null; status: string | null };
      if (!r.invoice_number) continue;
      invoiceByNumber.set(normalizeName(r.invoice_number), {
        id: r.id,
        invoice_type: r.invoice_type,
        status: r.status,
      });
    }
  }

  // Numéro source → facture insérée pendant CET import.
  const importedBySourceNumber = new Map<string, { id: string; status: string | null }>();

  async function insertInvoiceRow(
    row: MappedInvoice,
    clientId: string,
    creditedInvoiceId: string | null,
  ): Promise<void> {
    const isAvoir = row.invoice_type === 'avoir';
    // Un avoir ne se rattache jamais à un devis : le lier ferait croire au
    // devis qu'il a été facturé une fois de plus.
    const linkedQuoteId = !isAvoir && row.source_quote_number
      ? quoteNumberMap.get(row.source_quote_number) || null
      : null;

    for (let attempt = 0; attempt < 5; attempt++) {
      let invoiceNumber: string;
      if (isAvoir) {
        const padded =
          creditCounter < 1000 ? String(creditCounter).padStart(3, '0') : String(creditCounter);
        invoiceNumber = `${creditYearPrefix}${padded}`;
        creditCounter++;
      } else {
        const padded =
          counter < 1000 ? String(counter).padStart(3, '0') : String(counter);
        invoiceNumber = `${yearPrefix}${padded}`;
        counter++;
      }

      const payload = {
        invoice_number: invoiceNumber,
        client_id: clientId,
        quote_id: linkedQuoteId,
        title: row.title,
        status: row.status,
        invoice_type: row.invoice_type,
        credited_invoice_id: creditedInvoiceId,
        credit_reason: isAvoir ? row.credit_reason : null,
        total_ht: row.total_ht,
        total_tva: row.total_tva,
        tva_rate: row.tva_rate,
        total_ttc: row.total_ttc,
        due_date: row.due_date,
        paid_at: row.paid_at,
        issued_at: row.issued_at,
        user_id: userId,
        ...(row.issued_at ? { created_at: row.issued_at } : {}),
      };

      const { data, error } = await sb.from('invoices').insert(payload).select('id').single();
      if (error) {
        if (error.code === '23505') continue;
        counts.invoices.skipped++;
        counts.warnings.push({
          line: row.line,
          reason: `${isAvoir ? 'Avoir' : 'Facture'} « ${row.source_number} » non importé : ${error.message}`,
          hint: 'Vérifiez les montants HT et TTC de cette ligne dans votre fichier.',
        });
        return;
      }
      counts.invoices.inserted++;
      if (data?.id && row.source_number) {
        importedBySourceNumber.set(normalizeName(row.source_number), {
          id: data.id as string,
          status: row.status,
        });
      }
      return;
    }
    counts.invoices.skipped++;
    counts.warnings.push({
      line: row.line,
      reason: `${isAvoir ? 'Avoir' : 'Facture'} « ${row.source_number} » non importé : numéro déjà utilisé.`,
      hint: 'Relancez l\'import : un nouveau numéro sera attribué.',
    });
  }

  // ── 1re passe : les factures ────────────────────────────────────────────
  for (const row of standardRows) {
    const clientId = clientMap.get(normalizeName(row.client_name));
    if (!clientId || clientId === '__pending__') {
      counts.invoices.skipped++;
      continue;
    }
    await insertInvoiceRow(row, clientId, null);
  }

  // ── 2e passe : les avoirs, qui référencent une facture du même fichier ──
  for (const row of creditNoteRows) {
    const clientId = clientMap.get(normalizeName(row.client_name));
    if (!clientId || clientId === '__pending__') {
      counts.invoices.skipped++;
      continue;
    }

    const ref = normalizeName(row.credited_source_number);
    const fromBatch = ref ? importedBySourceNumber.get(ref) : undefined;
    const fromDb = ref ? invoiceByNumber.get(ref) : undefined;

    let creditedId: string | null = null;
    let cause: CreditNoteFallbackCause = 'facture_introuvable';

    if (fromBatch) {
      if ((CREDITABLE_STATUSES as readonly string[]).includes(fromBatch.status || '')) {
        creditedId = fromBatch.id;
      } else {
        cause = 'facture_non_creditable';
      }
    } else if (fromDb) {
      if (
        fromDb.invoice_type !== 'avoir'
        && (CREDITABLE_STATUSES as readonly string[]).includes(fromDb.status || '')
      ) {
        creditedId = fromDb.id;
      } else {
        cause = 'facture_non_creditable';
      }
    }

    if (!creditedId) {
      // La base refuse un avoir sans facture rectifiée valide : on rétrograde
      // en facture annulée (comportement historique) plutôt que de perdre la
      // ligne, et on le dit à l'artisan.
      const fallback = fallbackCreditNoteToCancelled(row, cause);
      counts.warnings.push(fallback.warning);
      await insertInvoiceRow(fallback.row, clientId, null);
      continue;
    }

    await insertInvoiceRow(row, clientId, creditedId);
  }
}

async function insertServices(
  sb: SupabaseClient,
  userId: string,
  rows: MappedService[],
  counts: CommitCounts,
): Promise<void> {
  if (rows.length === 0) return;

  // De-duplicate against existing prestations by normalized name.
  const { data: existing } = await sb
    .from('services')
    .select('name')
    .eq('user_id', userId)
    .is('deleted_at', null);
  const existingNames = new Set<string>();
  for (const s of existing || []) {
    existingNames.add(normalizeName((s as { name: string }).name));
  }

  const toInsert: Array<Record<string, unknown>> = [];
  const seenInBatch = new Set<string>();
  for (const row of rows) {
    const key = normalizeName(row.name);
    if (existingNames.has(key) || seenInBatch.has(key)) {
      counts.services.skipped++;
      continue;
    }
    seenInBatch.add(key);
    toInsert.push({
      name: row.name,
      description: row.description,
      unit: row.unit,
      unit_price: row.unit_price,
      category: row.category,
      tva_rate: row.tva_rate,
      is_recurring: false,
      frequency: 'mensuel',
      is_active: true,
      user_id: userId,
    });
  }

  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { data, error } = await sb.from('services').insert(chunk).select('id');
    if (error) {
      counts.services.skipped += chunk.length;
      continue;
    }
    counts.services.inserted += data?.length || 0;
  }
}

export async function POST(request: Request) {
  // Auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  // Parse files
  async function load(field: FormDataEntryValue | null) {
    if (!(field instanceof File) || field.size === 0) return null;
    if (field.size > MAX_FILE_SIZE) {
      throw new Error(`Le fichier ${field.name} dépasse la limite de 5 Mo.`);
    }
    return parseCSV(await readBytes(field));
  }

  let clientsParsed, quotesParsed, invoicesParsed, servicesParsed;
  try {
    clientsParsed = await load(formData.get('clients'));
    quotesParsed = await load(formData.get('quotes'));
    invoicesParsed = await load(formData.get('invoices'));
    servicesParsed = await load(formData.get('services'));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inattendue';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const clientMap = new Map<string, string>();
  const quoteNumberMap = new Map<string, string>();
  const counts: CommitCounts = {
    clients: { inserted: 0, skipped: 0 },
    quotes: { inserted: 0, skipped: 0 },
    invoices: { inserted: 0, skipped: 0 },
    services: { inserted: 0, skipped: 0 },
    warnings: [],
  };

  try {
    if (clientsParsed) {
      const mapped = mapContactsCSV(clientsParsed);
      await insertClients(sb, user.id, mapped.rows, clientMap, counts);
    } else {
      // Even if no clients file is provided, we still need a name → id map
      // for quotes/invoices to resolve against existing clients.
      const { data: existing } = await sb
        .from('clients')
        .select('id, name')
        .eq('user_id', user.id);
      for (const c of existing || []) {
        clientMap.set(
          normalizeName((c as { name: string }).name),
          (c as { id: string }).id,
        );
      }
    }

    if (quotesParsed) {
      const mapped = mapQuotesCSV(quotesParsed);
      await insertQuotes(sb, user.id, mapped.rows, clientMap, quoteNumberMap, counts);
    }

    if (invoicesParsed) {
      const mapped = mapInvoicesCSV(invoicesParsed);
      // Avoirs sans référence de facture d'origine dans le fichier : le
      // mapper les a déjà rétrogradés, il faut le dire à l'artisan.
      counts.warnings.push(...mapped.warnings);
      await insertInvoices(
        sb,
        user.id,
        mapped.rows,
        clientMap,
        quoteNumberMap,
        counts,
      );
    }

    if (servicesParsed) {
      const mapped = mapServicesCSV(servicesParsed);
      await insertServices(sb, user.id, mapped.rows, counts);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur lors de l'import";
    return NextResponse.json({ error: message, counts }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    counts,
    warnings: counts.warnings,
  });
}
