/**
 * POST /api/import/costructor/preview
 *
 * Accepts up to 3 CSV files (clients, quotes, invoices) as multipart form
 * fields and returns a parsed preview without writing anything to the
 * database. The client uses the response to show the user exactly what will
 * be imported and to surface any per-row errors.
 *
 * The route is auth-gated (Bearer token from the Supabase session) so that
 * unauthenticated users can't burn server CPU by uploading huge files, but it
 * does not modify any user data.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseCSV } from '@/lib/import/csv-parser';
import {
  mapContactsCSV,
  mapQuotesCSV,
  mapInvoicesCSV,
  mapServicesCSV,
} from '@/lib/import/costructor';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Cap at 5MB per file — Costructor exports for a typical artisan are well
// under 1MB, this leaves plenty of headroom while preventing abuse.
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function readFileBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

export async function POST(request: Request) {
  // Auth — required even though we don't write anything.
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

  const clientsFile = formData.get('clients');
  const quotesFile = formData.get('quotes');
  const invoicesFile = formData.get('invoices');
  const servicesFile = formData.get('services');

  const result: {
    clients: ReturnType<typeof mapContactsCSV> | null;
    quotes: ReturnType<typeof mapQuotesCSV> | null;
    invoices: ReturnType<typeof mapInvoicesCSV> | null;
    services: ReturnType<typeof mapServicesCSV> | null;
  } = { clients: null, quotes: null, invoices: null, services: null };

  async function processField<T>(
    field: FormDataEntryValue | null,
    mapper: (parsed: ReturnType<typeof parseCSV>) => T,
  ): Promise<T | null> {
    if (!(field instanceof File)) return null;
    if (field.size === 0) return null;
    if (field.size > MAX_FILE_SIZE) {
      throw new Error(`Le fichier ${field.name} dépasse la limite de 5 Mo.`);
    }
    const bytes = await readFileBytes(field);
    const parsed = parseCSV(bytes);
    return mapper(parsed);
  }

  try {
    result.clients = await processField(clientsFile, mapContactsCSV);
    result.quotes = await processField(quotesFile, mapQuotesCSV);
    result.invoices = await processField(invoicesFile, mapInvoicesCSV);
    result.services = await processField(servicesFile, mapServicesCSV);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inattendue';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!result.clients && !result.quotes && !result.invoices && !result.services) {
    return NextResponse.json(
      { error: 'Aucun fichier reçu. Joignez au moins un export CSV.' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    counts: {
      clients: result.clients?.rows.length || 0,
      quotes: result.quotes?.rows.length || 0,
      invoices: result.invoices?.rows.length || 0,
      services: result.services?.rows.length || 0,
      errors:
        (result.clients?.errors.length || 0) +
        (result.quotes?.errors.length || 0) +
        (result.invoices?.errors.length || 0) +
        (result.services?.errors.length || 0),
    },
    clients: result.clients,
    quotes: result.quotes,
    invoices: result.invoices,
    services: result.services,
  });
}
