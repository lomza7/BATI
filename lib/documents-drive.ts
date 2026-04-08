/**
 * Helpers for the "Mes documents" feature.
 *
 * Folder creation and project_photos sync are now handled entirely by DB
 * triggers (see migration 20260408110000_documents_project_sync.sql), so this
 * module only exposes a filename sanitizer used by the upload flow.
 */

export function sanitizeDocumentFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}
