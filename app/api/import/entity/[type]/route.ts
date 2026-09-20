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
  fallbackCreditNoteToCancelled,
  type CreditNoteFallbackCause,
  type ImportWarning,
  type MappedInvoice,
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
  /**
   * Lignes importées mais dégradées — typiquement un avoir rétrogradé en
   * facture annulée faute de facture d'origine résolvable. Elles ne sont ni
   * des erreurs (la ligne est en base) ni un succès complet.
   */
  warnings?: ImportWarning[];
}

/**
 * Facture candidate au rattachement d'un avoir. `client_id` en fait partie :
 * un avoir ne rectifie jamais la facture d'un autre client, et c'est le seul
 * garde-fou contre deux numérotations homonymes.
 */
interface CreditTarget {
  id: string;
  invoice_type: string | null;
  status: string | null;
  project_id: string | null;
  client_id: string | null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Numéro du document tel qu'il figure dans le FICHIER SOURCE de l'artisan.
 *
 * Hellobat REGÉNÈRE le numéro de chaque document importé (série `F-YYYY-NNN`),
 * si bien que le numéro d'origine disparaissait jusqu'ici. Un avoir du même
 * fichier — ou d'un second fichier importé plus tard — référence pourtant la
 * facture par SON numéro d'origine : sans trace de ce numéro, plus aucun avoir
 * n'était rattachable et tous finissaient rétrogradés en factures annulées.
 *
 * On le conserve donc dans `invoices.description`, avec exactement la même
 * convention que l'import des devis et que `attach-pdfs`, qui la relit déjà :
 * « Importé (F-2025-042) ». Cette mention apparaît sous le titre dans
 * l'aperçu du document, comme celle des devis importés : c'est la seule
 * trace du numéro d'origine, et elle rend la facture reconnaissable.
 *
 * Helpers volontairement locaux : `lib/invoices/credit-notes.ts` est partagé
 * et hors périmètre de ce lot.
 */
const SOURCE_NUMBER_PATTERN = /Importé \(([^)]+)\)/;

function buildImportDescription(sourceNumber: string | null | undefined): string {
  const trimmed = (sourceNumber || '').trim();
  return trimmed ? `Importé (${trimmed})` : '';
}

function extractSourceNumber(description: string | null | undefined): string {
  if (!description) return '';
  const match = description.match(SOURCE_NUMBER_PATTERN);
  return match ? match[1].trim() : '';
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
  // Avertissements déjà produits par le mapper (avoir sans référence de
  // facture d'origine dans le fichier), enrichis plus bas par ceux des
  // références non résolvables.
  const warnings: ImportWarning[] = [...mapped.warnings];

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

  // Série AV- des avoirs, distincte de la série F- : on ne la réserve que si
  // le fichier en contient, pour ne pas payer une requête inutile.
  const creditNoteRows = mapped.rows.filter((r) => isCreditNote(r));
  const standardRows = mapped.rows.filter((r) => !isCreditNote(r));
  let creditYearPrefix = '';
  let creditCounter = 1;
  // Factures déjà en base, indexées par le numéro du fichier source (celui que
  // porte un avoir) : un avoir du fichier peut rectifier une facture importée
  // lors d'un passage précédent, qui a reçu un numéro Hellobat sans rapport
  // avec celui de l'ancien logiciel.
  const invoiceBySourceNumber = new Map<string, CreditTarget>();
  // Même chose sur la numérotation Hellobat : conservé en dernier recours,
  // mais utilisable seulement si la facture appartient au même client (les
  // deux numérotations partagent le gabarit « F-YYYY-NNN » et se recouvrent).
  const invoiceByNumber = new Map<string, CreditTarget>();

  if (creditNoteRows.length > 0) {
    const nextCredit = await getNextCreditNoteNumber(sb, userId);
    creditYearPrefix = nextCredit.slice(0, 8); // "AV-YYYY-"
    creditCounter = parseInt(nextCredit.slice(creditYearPrefix.length), 10) || 1;

    const { data: existingInvoices } = await sb
      .from('invoices')
      .select('id, invoice_number, invoice_type, status, project_id, client_id, description')
      .eq('user_id', userId);
    for (const inv of existingInvoices || []) {
      const invRow = inv as {
        id: string;
        invoice_number: string | null;
        invoice_type: string | null;
        status: string | null;
        project_id: string | null;
        client_id: string | null;
        description: string | null;
      };
      const target: CreditTarget = {
        id: invRow.id,
        invoice_type: invRow.invoice_type,
        status: invRow.status,
        project_id: invRow.project_id,
        client_id: invRow.client_id,
      };
      const sourceNumber = extractSourceNumber(invRow.description);
      if (sourceNumber) invoiceBySourceNumber.set(normalizeName(sourceNumber), target);
      if (invRow.invoice_number) invoiceByNumber.set(normalizeName(invRow.invoice_number), target);
    }
  }

  let inserted = 0;
  let skipped = mapped.errors.length;

  // Numéro source → facture insérée pendant CET import, pour qu'un avoir
  // puisse rectifier une facture du même fichier.
  const importedBySourceNumber = new Map<string, CreditTarget>();

  async function insertInvoiceRow(
    row: MappedInvoice,
    clientId: string,
    projectId: string | null,
    creditedInvoiceId: string | null,
  ): Promise<void> {
    const isAvoir = row.invoice_type === 'avoir';
    for (let attempt = 0; attempt < 5; attempt++) {
      let invoiceNumber: string;
      if (isAvoir) {
        const padded = creditCounter < 1000 ? String(creditCounter).padStart(3, '0') : String(creditCounter);
        invoiceNumber = `${creditYearPrefix}${padded}`;
        creditCounter++;
      } else {
        const padded = counter < 1000 ? String(counter).padStart(3, '0') : String(counter);
        invoiceNumber = `${yearPrefix}${padded}`;
        counter++;
      }

      const payload = {
        invoice_number: invoiceNumber,
        client_id: clientId,
        project_id: projectId,
        quote_id: null,
        title: row.title,
        // Numéro d'origine conservé : c'est lui qu'un avoir référence, ici ou
        // lors d'un import ultérieur.
        description: buildImportDescription(row.source_number),
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
        skipped++;
        errors.push({
          line: row.line,
          reason: `${isAvoir ? 'Avoir' : 'Facture'} « ${row.source_number} » : ${error.message}`,
          hint: 'Vérifiez que les montants HT et TTC sont des nombres valides.',
        });
        return;
      }
      inserted++;
      if (data?.id && row.source_number) {
        importedBySourceNumber.set(normalizeName(row.source_number), {
          id: data.id as string,
          invoice_type: row.invoice_type,
          status: row.status,
          project_id: projectId,
          client_id: clientId,
        });
      }
      return;
    }
    skipped++;
    errors.push({
      line: row.line,
      reason: `${isAvoir ? 'Avoir' : 'Facture'} « ${row.source_number} » : numéro déjà utilisé, ligne ignorée.`,
      hint: 'Relancez l\'import : un nouveau numéro sera attribué.',
    });
  }

  // ── 1re passe : les factures ────────────────────────────────────────────
  // Les avoirs viennent ensuite : ils doivent pouvoir référencer une facture
  // du même fichier, qui n'existe qu'une fois insérée.
  for (const row of standardRows) {
    const client = clientMap.get(normalizeName(row.client_name));
    if (!client) {
      skipped++;
      errors.push({
        line: row.line,
        reason: `Client introuvable : « ${row.client_name} »`,
        hint: 'Importez d\'abord vos contacts depuis l\'onglet Contacts, ou créez ce client manuellement.',
      });
      continue;
    }

    // Create a project (chantier) for this invoice — skip for deposits.
    // `creates_project` est à false sur les lignes d'avoir rétrogradées : sans
    // ce test, un avoir fabriquerait un chantier au budget négatif, qui
    // polluerait la carte, la liste des chantiers et tous les cumuls.
    let projectId: string | null = null;
    const projectName = row.title || 'Chantier importé';
    const isDeposit = /\b(acompte|accompte|solde)\b/i.test(projectName);
    const isCompleted = row.status === 'payee';

    if (!isDeposit && row.creates_project) {
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

    await insertInvoiceRow(row, client.id, projectId, null);
  }

  // ── 2e passe : les avoirs ───────────────────────────────────────────────
  for (const row of creditNoteRows) {
    const client = clientMap.get(normalizeName(row.client_name));
    if (!client) {
      skipped++;
      errors.push({
        line: row.line,
        reason: `Client introuvable : « ${row.client_name} »`,
        hint: 'Importez d\'abord vos contacts depuis l\'onglet Contacts, ou créez ce client manuellement.',
      });
      continue;
    }

    // `credited_source_number` est le numéro tel qu'il figure dans le fichier
    // de l'ancien logiciel : on le cherche donc d'abord dans la numérotation
    // SOURCE — celle du même import, puis celle des imports précédents. La
    // numérotation Hellobat n'arrive qu'en dernier recours : les deux séries
    // partagent le gabarit « F-YYYY-NNN », et un simple homonyme ferait
    // créditer la facture d'un tiers.
    const ref = normalizeName(row.credited_source_number);
    const candidate = ref
      ? importedBySourceNumber.get(ref) || invoiceBySourceNumber.get(ref) || invoiceByNumber.get(ref)
      : undefined;

    let creditedId: string | null = null;
    let creditedProjectId: string | null = null;
    let cause: CreditNoteFallbackCause | null = null;

    if (!candidate) {
      cause = 'facture_introuvable';
    } else if (
      candidate.invoice_type === 'avoir'
      || !(CREDITABLE_STATUSES as readonly string[]).includes(candidate.status || '')
    ) {
      // La base refuse un avoir sur un brouillon ou sur un avoir.
      cause = 'facture_non_creditable';
    } else if (candidate.client_id !== client.id) {
      // Homonymie de numéro entre deux clients : mieux vaut une facture
      // annulée signalée dans le rapport qu'un avoir posé sur la facture de
      // quelqu'un d'autre, qui amputerait son net dû, sa relance et le CA.
      cause = 'facture_non_creditable';
    } else {
      creditedId = candidate.id;
      creditedProjectId = candidate.project_id;
    }

    if (!creditedId) {
      // Plutôt que de laisser partir un INSERT que la base rejettera, on
      // rétrograde en facture annulée et on le dit à l'artisan.
      const fallback = fallbackCreditNoteToCancelled(row, cause || 'facture_introuvable');
      warnings.push(fallback.warning);
      await insertInvoiceRow(fallback.row, client.id, null, null);
      continue;
    }

    // Un avoir ne crée jamais de chantier : il reprend celui de la facture
    // rectifiée quand elle en a un, pour rester dans le même dossier.
    await insertInvoiceRow(row, client.id, creditedProjectId, creditedId);
  }

  return {
    type: 'invoices',
    inserted,
    skipped,
    total: mapped.rows.length + mapped.errors.length,
    errors,
    warnings,
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
