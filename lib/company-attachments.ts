import type { SupabaseClient } from '@supabase/supabase-js';

export interface FetchedCompanyAttachment {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  /** Base64-encoded file content (no data URL prefix). */
  content_base64: string;
}

type DocumentScope = 'quotes' | 'invoices';

/**
 * Recupere les pieces jointes par defaut de l'artisan (attestations, assurances, etc.)
 * et les telecharge depuis Supabase Storage en base64. Si `excludeIds` est fourni,
 * les fichiers correspondants ne sont pas inclus (l'utilisateur les a decoches
 * juste avant l'envoi du devis ou de la facture).
 *
 * Cette fonction utilise un client Supabase admin (service role) car les
 * routes API tournent cote serveur.
 */
export async function fetchCompanyAttachmentsForUser(
  admin: SupabaseClient,
  userId: string,
  scope: DocumentScope,
  options: { excludeIds?: string[] } = {},
): Promise<FetchedCompanyAttachment[]> {
  const flagColumn = scope === 'quotes' ? 'attach_to_quotes' : 'attach_to_invoices';
  const { data, error } = await admin
    .from('company_attachments')
    .select('id, name, mime_type, size_bytes, storage_path, attach_to_quotes, attach_to_invoices')
    .eq('user_id', userId)
    .eq(flagColumn, true)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  const exclude = new Set(options.excludeIds || []);
  const wanted = data.filter(d => !exclude.has(d.id as string));
  if (wanted.length === 0) return [];

  const results: FetchedCompanyAttachment[] = [];
  for (const row of wanted) {
    const { data: blob, error: dlError } = await admin.storage
      .from('company-attachments')
      .download(row.storage_path as string);
    if (dlError || !blob) {
      console.error('[company-attachments] download failed', row.storage_path, dlError);
      continue;
    }
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    results.push({
      id: row.id as string,
      name: row.name as string,
      mime_type: (row.mime_type as string) || 'application/octet-stream',
      size_bytes: Number(row.size_bytes) || arrayBuffer.byteLength,
      content_base64: base64,
    });
  }

  return results;
}
