/**
 * POST /api/import/attach-pdfs/:type
 *
 * Attache des PDF d'origine (exportes depuis l'ancien logiciel de l'artisan)
 * a des devis ou factures deja importes. Chaque PDF est matche par numero
 * (source_number ou quote_number / invoice_number) present dans le nom du
 * fichier.
 *
 * Uploads dans le bucket prive `imported-documents` au chemin
 *   {user_id}/{quotes|invoices}/{id}.pdf
 *
 * Met a jour `quotes.import_pdf_path` / `invoices.import_pdf_path`.
 *
 * Reponse : { matched, unmatched, errors } pour que l'UI puisse indiquer
 * a l'artisan exactement quels PDF n'ont pas ete associes.
 */

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 200;
const VALID_TYPES = ['quotes', 'invoices'] as const;
type EntityType = (typeof VALID_TYPES)[number];

interface MatchedPdf {
  filename: string;
  document_id: string;
  document_number: string;
}

interface UnmatchedPdf {
  filename: string;
  reason: string;
}

interface AttachPdfsResult {
  type: EntityType;
  total: number;
  matched: MatchedPdf[];
  unmatched: UnmatchedPdf[];
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\s]+/g, '');
}

async function listDocuments(
  sb: SupabaseClient,
  userId: string,
  type: EntityType,
): Promise<Array<{ id: string; number: string; source: string | null }>> {
  if (type === 'quotes') {
    const { data } = await sb
      .from('quotes')
      .select('id, quote_number, description')
      .eq('user_id', userId);
    return (data || []).map((q) => ({
      id: q.id as string,
      number: q.quote_number as string,
      source: extractSourceNumber(q.description as string | null),
    }));
  }
  const { data } = await sb
    .from('invoices')
    .select('id, invoice_number, title')
    .eq('user_id', userId);
  return (data || []).map((f) => ({
    id: f.id as string,
    number: f.invoice_number as string,
    source: null,
  }));
}

function extractSourceNumber(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/Importé \(([^)]+)\)/);
  return m ? m[1] : null;
}

function matchFileToDocument(
  filename: string,
  docs: Array<{ id: string; number: string; source: string | null }>,
): { id: string; number: string } | null {
  const normalizedFilename = normalizeForMatch(filename.replace(/\.pdf$/i, ''));

  // Try source_number (original number from the imported CSV) first — it's
  // what the artisan's filename will actually contain.
  for (const doc of docs) {
    if (doc.source) {
      const normalizedSource = normalizeForMatch(doc.source);
      if (normalizedSource.length >= 3 && normalizedFilename.includes(normalizedSource)) {
        return { id: doc.id, number: doc.number };
      }
    }
  }

  // Fallback: match by generated Hellobat number.
  for (const doc of docs) {
    const normalizedNumber = normalizeForMatch(doc.number);
    if (normalizedNumber.length >= 3 && normalizedFilename.includes(normalizedNumber)) {
      return { id: doc.id, number: doc.number };
    }
  }

  return null;
}

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

  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      {
        error: 'Aucun PDF reçu',
        hint: 'Déposez un ou plusieurs fichiers PDF.',
      },
      { status: 400 },
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Trop de fichiers (${files.length}). Maximum : ${MAX_FILES} par envoi.` },
      { status: 400 },
    );
  }

  const docs = await listDocuments(sb, user.id, type);
  if (docs.length === 0) {
    return NextResponse.json(
      {
        error: type === 'quotes'
          ? 'Aucun devis trouvé. Importez d\'abord votre fichier CSV de devis.'
          : 'Aucune facture trouvée. Importez d\'abord votre fichier CSV de factures.',
      },
      { status: 400 },
    );
  }

  const matched: MatchedPdf[] = [];
  const unmatched: UnmatchedPdf[] = [];

  for (const file of files) {
    if (file.size === 0) {
      unmatched.push({ filename: file.name, reason: 'Fichier vide' });
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      unmatched.push({
        filename: file.name,
        reason: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo, max ${MAX_FILE_SIZE / 1024 / 1024} Mo)`,
      });
      continue;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      unmatched.push({ filename: file.name, reason: 'Format non pris en charge (PDF attendu)' });
      continue;
    }

    const match = matchFileToDocument(file.name, docs);
    if (!match) {
      unmatched.push({
        filename: file.name,
        reason: type === 'quotes'
          ? 'Aucun devis dont le numéro apparaît dans le nom du fichier'
          : 'Aucune facture dont le numéro apparaît dans le nom du fichier',
      });
      continue;
    }

    const storagePath = `${user.id}/${type}/${match.id}.pdf`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await sb.storage
      .from('imported-documents')
      .upload(storagePath, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadError) {
      unmatched.push({
        filename: file.name,
        reason: `Erreur de stockage : ${uploadError.message}`,
      });
      continue;
    }

    const { error: updateError } = await sb
      .from(type)
      .update({ import_pdf_path: storagePath })
      .eq('id', match.id);
    if (updateError) {
      unmatched.push({
        filename: file.name,
        reason: `Erreur enregistrement : ${updateError.message}`,
      });
      continue;
    }

    matched.push({
      filename: file.name,
      document_id: match.id,
      document_number: match.number,
    });
  }

  const result: AttachPdfsResult = {
    type,
    total: files.length,
    matched,
    unmatched,
  };
  return NextResponse.json(result);
}
