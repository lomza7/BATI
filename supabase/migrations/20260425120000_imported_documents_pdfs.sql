-- ============================================================
-- PDF d'origine pour devis et factures importes : on garde le
-- PDF tel qu'exporte depuis l'ancien logiciel de l'artisan, pour
-- le montrer dans l'apercu (au lieu de la mise en page reconstruite
-- a partir de quote_lines / invoice_lines qui n'existent pas en
-- import CSV).
-- ============================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS import_pdf_path text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS import_pdf_path text;

-- Bucket prive, accessible via signed URL generee cote serveur.
INSERT INTO storage.buckets (id, name, public)
VALUES ('imported-documents', 'imported-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS workspace_select_imported_documents ON storage.objects;
DROP POLICY IF EXISTS workspace_insert_imported_documents ON storage.objects;
DROP POLICY IF EXISTS workspace_update_imported_documents ON storage.objects;
DROP POLICY IF EXISTS workspace_delete_imported_documents ON storage.objects;

CREATE POLICY workspace_select_imported_documents
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'imported-documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_insert_imported_documents
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'imported-documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_update_imported_documents
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'imported-documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  )
  WITH CHECK (
    bucket_id = 'imported-documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_delete_imported_documents
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'imported-documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );
