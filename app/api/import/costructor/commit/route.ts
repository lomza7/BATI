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
  type MappedClient,
  type MappedQuote,
  type MappedInvoice,
  type MappedService,
} from '@/lib/import/costructor';
import {
  getNextQuoteNumber,
  getNextInvoiceNumber,
} from '@/lib/document-numbers';

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

  for (const row of rows) {
    const clientId = clientMap.get(normalizeName(row.client_name));
    if (!clientId || clientId === '__pending__') {
      counts.invoices.skipped++;
      continue;
    }
    const linkedQuoteId = row.source_quote_number
      ? quoteNumberMap.get(row.source_quote_number) || null
      : null;

    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const padded =
        counter < 1000 ? String(counter).padStart(3, '0') : String(counter);
      const invoiceNumber = `${yearPrefix}${padded}`;
      counter++;

      const payload = {
        invoice_number: invoiceNumber,
        client_id: clientId,
        quote_id: linkedQuoteId,
        title: row.title,
        status: row.status,
        total_ht: row.total_ht,
        tva_rate: row.tva_rate,
        total_ttc: row.total_ttc,
        due_date: row.due_date,
        paid_at: row.paid_at,
        issued_at: row.issued_at,
        user_id: userId,
        ...(row.issued_at ? { created_at: row.issued_at } : {}),
      };

      const { error } = await sb.from('invoices').insert(payload);
      if (error) {
        if (error.code === '23505') continue;
        counts.invoices.skipped++;
        break;
      }
      counts.invoices.inserted++;
      inserted = true;
    }
    if (!inserted) counts.invoices.skipped++;
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
  });
}
