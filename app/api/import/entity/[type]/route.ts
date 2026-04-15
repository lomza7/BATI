/**
 * POST /api/import/entity/:type
 *
 * Single-entity CSV import endpoint used by the in-page "Importer" button on
 * the clients, prestations, devis and factures pages. Unlike the onboarding
 * flow (which juggles three files at once), this route imports exactly one
 * entity type from one CSV file at a time, returning a precise success /
 * error breakdown the UI can show to the user.
 *
 * Supported `:type` values:
 *   - clients     → inserts into `clients`
 *   - services    → inserts into `services`        (prestations)
 *   - quotes      → inserts into `quotes`          (devis)
 *   - invoices    → inserts into `invoices`        (factures)
 *
 * Auth is required: inserts go through an authenticated client so RLS scopes
 * everything to `auth.uid()`.
 *
 * Errors are made as actionable as possible — every skipped row carries a
 * line number AND a human-readable reason explaining what to fix.
 */

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseCSV } from '@/lib/import/csv-parser';
import {
  mapContactsCSV,
  mapServicesCSV,
  mapQuotesCSV,
  mapInvoicesCSV,
} from '@/lib/import/costructor';
import {
  getNextQuoteNumber,
  getNextInvoiceNumber,
} from '@/lib/document-numbers';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_TYPES = ['clients', 'services', 'quotes', 'invoices'] as const;
type EntityType = (typeof VALID_TYPES)[number];

interface ImportError {
  line: number;
  reason: string;
  hint?: string;
}

interface ImportResult {
  type: EntityType;
  inserted: number;
  skipped: number;
  total: number;
  errors: ImportError[];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function readBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

// ── Per-entity importers ─────────────────────────────────────────────────────

async function importClients(
  sb: SupabaseClient,
  userId: string,
  bytes: Uint8Array,
): Promise<ImportResult> {
  const parsed = parseCSV(bytes);
  const mapped = mapContactsCSV(parsed);
  const errors: ImportError[] = mapped.errors.map((e) => ({
    line: e.line,
    reason: e.reason,
    hint: 'Ajoutez une colonne « Nom » (ou « Prénom » + « Nom ») et une valeur sur cette ligne.',
  }));

  // De-duplicate by normalized name against existing clients.
  const { data: existing } = await sb
    .from('clients')
    .select('id, name')
    .eq('user_id', userId);
  const existingNames = new Set<string>();
  for (const c of existing || []) {
    existingNames.add(normalizeName((c as { name: string }).name));
  }

  const toInsert: Array<Record<string, unknown>> = [];
  let skipped = mapped.errors.length;
  const seenInBatch = new Set<string>();
  for (const row of mapped.rows) {
    const key = normalizeName(row.name);
    if (existingNames.has(key) || seenInBatch.has(key)) {
      skipped++;
      errors.push({
        line: parseInt(row.externalId, 10) || 0,
        reason: `« ${row.name} » existe déjà dans vos contacts`,
        hint: 'Renommez la ligne dans votre fichier ou supprimez le doublon.',
      });
      continue;
    }
    seenInBatch.add(key);
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

  let inserted = 0;
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { data, error } = await sb.from('clients').insert(chunk).select('id');
    if (error) {
      skipped += chunk.length;
      errors.push({
        line: 0,
        reason: `Erreur d'insertion : ${error.message}`,
        hint: 'Vérifiez que votre fichier ne contient pas de caractères inhabituels.',
      });
      continue;
    }
    inserted += data?.length || 0;
  }

  return {
    type: 'clients',
    inserted,
    skipped,
    total: mapped.rows.length + mapped.errors.length,
    errors,
  };
}

async function importServices(
  sb: SupabaseClient,
  userId: string,
  bytes: Uint8Array,
): Promise<ImportResult> {
  const parsed = parseCSV(bytes);
  const mapped = mapServicesCSV(parsed);
  const errors: ImportError[] = mapped.errors.map((e) => ({
    line: e.line,
    reason: e.reason,
    hint: 'Ajoutez une colonne « Nom » (ou « Désignation ») et un libellé sur cette ligne.',
  }));

  // De-duplicate by lowercase name.
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
  let skipped = mapped.errors.length;
  const seenInBatch = new Set<string>();
  for (const row of mapped.rows) {
    const key = normalizeName(row.name);
    if (existingNames.has(key) || seenInBatch.has(key)) {
      skipped++;
      errors.push({
        line: parseInt(row.externalId, 10) || 0,
        reason: `« ${row.name} » existe déjà dans votre bibliothèque`,
        hint: 'Renommez la prestation dans votre fichier ou supprimez le doublon.',
      });
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

  let inserted = 0;
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { data, error } = await sb.from('services').insert(chunk).select('id');
    if (error) {
      skipped += chunk.length;
      errors.push({
        line: 0,
        reason: `Erreur d'insertion : ${error.message}`,
        hint: 'Vérifiez le format des prix (utilisez la virgule, ex: 12,50).',
      });
      continue;
    }
    inserted += data?.length || 0;
  }

  return {
    type: 'services',
    inserted,
    skipped,
    total: mapped.rows.length + mapped.errors.length,
    errors,
  };
}

async function importQuotes(
  sb: SupabaseClient,
  userId: string,
  bytes: Uint8Array,
): Promise<ImportResult> {
  const parsed = parseCSV(bytes);
  const mapped = mapQuotesCSV(parsed);
  const errors: ImportError[] = mapped.errors.map((e) => ({
    line: e.line,
    reason: e.reason,
    hint: e.reason.includes('Client')
      ? 'Ajoutez une colonne « Client » (ou « Customer ») avec le nom du contact.'
      : 'Ajoutez une colonne « Numéro » avec une référence sur chaque ligne.',
  }));

  // Build a map of existing clients so we can resolve client names.
  const { data: existingClients } = await sb
    .from('clients')
    .select('id, name')
    .eq('user_id', userId);
  const clientMap = new Map<string, string>();
  for (const c of existingClients || []) {
    clientMap.set(
      normalizeName((c as { name: string }).name),
      (c as { id: string }).id,
    );
  }

  let next = await getNextQuoteNumber(sb, userId);
  const yearPrefix = next.slice(0, 7);
  let counter = parseInt(next.slice(yearPrefix.length), 10) || 1;

  let inserted = 0;
  let skipped = mapped.errors.length;

  for (const row of mapped.rows) {
    const clientId = clientMap.get(normalizeName(row.client_name));
    if (!clientId) {
      skipped++;
      errors.push({
        line: parseInt(row.externalId, 10) || 0,
        reason: `Client introuvable : « ${row.client_name} »`,
        hint: 'Importez d\'abord vos contacts depuis l\'onglet Contacts, ou créez ce client manuellement.',
      });
      continue;
    }

    let success = false;
    for (let attempt = 0; attempt < 5 && !success; attempt++) {
      const padded = counter < 1000 ? String(counter).padStart(3, '0') : String(counter);
      const quoteNumber = `${yearPrefix}${padded}`;
      counter++;

      const payload = {
        quote_number: quoteNumber,
        client_id: clientId,
        title: row.title,
        description: row.description
          ? `${row.description}\n\n— Importé (${row.source_number})`
          : `Importé (${row.source_number})`,
        status: row.status,
        total_ht: row.total_ht,
        tva_rate: row.tva_rate,
        total_ttc: row.total_ttc,
        valid_until: row.valid_until,
        user_id: userId,
        ...(row.issued_at ? { created_at: row.issued_at } : {}),
      };

      const { error } = await sb.from('quotes').insert(payload);
      if (error) {
        if (error.code === '23505') continue;
        skipped++;
        errors.push({
          line: parseInt(row.externalId, 10) || 0,
          reason: `Devis « ${row.source_number} » : ${error.message}`,
          hint: 'Vérifiez que les montants HT et TTC sont des nombres valides.',
        });
        break;
      }
      inserted++;
      success = true;
    }
    if (!success && !errors.some((e) => e.reason.includes(row.source_number))) {
      skipped++;
    }
  }

  return {
    type: 'quotes',
    inserted,
    skipped,
    total: mapped.rows.length + mapped.errors.length,
    errors,
  };
}

async function importInvoices(
  sb: SupabaseClient,
  userId: string,
  bytes: Uint8Array,
): Promise<ImportResult> {
  const parsed = parseCSV(bytes);
  const mapped = mapInvoicesCSV(parsed);
  const errors: ImportError[] = mapped.errors.map((e) => ({
    line: e.line,
    reason: e.reason,
    hint: e.reason.includes('Client')
      ? 'Ajoutez une colonne « Client » (ou « Customer ») avec le nom du contact.'
      : 'Ajoutez une colonne « Numéro » avec une référence sur chaque ligne.',
  }));

  const { data: existingClients } = await sb
    .from('clients')
    .select('id, name, address, city, postal_code')
    .eq('user_id', userId);
  const clientMap = new Map<string, { id: string; address: string; city: string; postal_code: string }>();
  for (const c of existingClients || []) {
    const client = c as { id: string; name: string; address?: string; city?: string; postal_code?: string };
    clientMap.set(
      normalizeName(client.name),
      { id: client.id, address: client.address || '', city: client.city || '', postal_code: client.postal_code || '' },
    );
  }

  let next = await getNextInvoiceNumber(sb, userId);
  const yearPrefix = next.slice(0, 7);
  let counter = parseInt(next.slice(yearPrefix.length), 10) || 1;

  let inserted = 0;
  let skipped = mapped.errors.length;

  for (const row of mapped.rows) {
    const client = clientMap.get(normalizeName(row.client_name));
    if (!client) {
      skipped++;
      errors.push({
        line: parseInt(row.externalId, 10) || 0,
        reason: `Client introuvable : « ${row.client_name} »`,
        hint: 'Importez d\'abord vos contacts depuis l\'onglet Contacts, ou créez ce client manuellement.',
      });
      continue;
    }

    // Create a project (chantier) for this invoice — skip for deposits
    let projectId: string | null = null;
    const projectName = row.title || 'Chantier importé';
    const isDeposit = /\b(acompte|accompte|solde)\b/i.test(projectName);
    const isCompleted = row.status === 'payee';

    if (!isDeposit) {
      const { data: project } = await sb
        .from('projects')
        .insert({
          user_id: userId,
          name: projectName,
          client_id: client.id,
          address: client.address,
          city: client.city,
          postal_code: client.postal_code,
          status: isCompleted ? 'termine' : 'en_cours',
          progress: isCompleted ? 100 : 0,
          budget: row.total_ttc || 0,
          start_date: row.issued_at || null,
          end_date: isCompleted ? (row.paid_at || row.issued_at || null) : null,
          notes: row.source_number
            ? `Importé depuis facture ${row.source_number}`
            : 'Importé depuis facture',
          is_public: isCompleted,
          published_at: isCompleted ? new Date().toISOString() : null,
        })
        .select('id')
        .single();
      if (project) {
        projectId = project.id;
      }
    }

    let success = false;
    for (let attempt = 0; attempt < 5 && !success; attempt++) {
      const padded = counter < 1000 ? String(counter).padStart(3, '0') : String(counter);
      const invoiceNumber = `${yearPrefix}${padded}`;
      counter++;

      const payload = {
        invoice_number: invoiceNumber,
        client_id: client.id,
        project_id: projectId,
        quote_id: null,
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
        skipped++;
        errors.push({
          line: parseInt(row.externalId, 10) || 0,
          reason: `Facture « ${row.source_number} » : ${error.message}`,
          hint: 'Vérifiez que les montants HT et TTC sont des nombres valides.',
        });
        break;
      }
      inserted++;
      success = true;
    }
    if (!success && !errors.some((e) => e.reason.includes(row.source_number))) {
      skipped++;
    }
  }

  return {
    type: 'invoices',
    inserted,
    skipped,
    total: mapped.rows.length + mapped.errors.length,
    errors,
  };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: { type: string } },
) {
  const type = params.type as EntityType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Type d'import inconnu : ${type}` },
      { status: 400 },
    );
  }

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

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      {
        error: 'Aucun fichier reçu',
        hint: 'Sélectionnez un fichier CSV avant de lancer l\'import.',
      },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `Fichier trop volumineux (max ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)} Mo)`,
        hint: 'Découpez votre fichier en plusieurs CSV plus petits.',
      },
      { status: 400 },
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = await readBytes(file);
  } catch {
    return NextResponse.json(
      { error: 'Lecture du fichier impossible' },
      { status: 400 },
    );
  }

  try {
    let result: ImportResult;
    switch (type) {
      case 'clients':
        result = await importClients(sb, user.id, bytes);
        break;
      case 'services':
        result = await importServices(sb, user.id, bytes);
        break;
      case 'quotes':
        result = await importQuotes(sb, user.id, bytes);
        break;
      case 'invoices':
        result = await importInvoices(sb, user.id, bytes);
        break;
    }

    if (result.total === 0) {
      return NextResponse.json(
        {
          error: 'Aucune ligne lisible dans le fichier',
          hint: 'Vérifiez que la première ligne contient bien les en-têtes (Nom, Email, etc.) et que le fichier est bien encodé en UTF-8 ou Windows-1252.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur lors de l'import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
