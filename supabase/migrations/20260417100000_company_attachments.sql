-- ============================================================
-- Company attachments: attestations / assurances jointes par defaut
-- aux devis et factures envoyes au client.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  attach_to_quotes boolean NOT NULL DEFAULT true,
  attach_to_invoices boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_attachments_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT company_attachments_storage_path_not_empty CHECK (char_length(trim(storage_path)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_company_attachments_user
  ON public.company_attachments(user_id, position, created_at);

ALTER TABLE public.company_attachments ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.company_attachments;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.company_attachments
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS workspace_select ON public.company_attachments;
DROP POLICY IF EXISTS workspace_insert ON public.company_attachments;
DROP POLICY IF EXISTS workspace_update ON public.company_attachments;
DROP POLICY IF EXISTS workspace_delete ON public.company_attachments;

CREATE POLICY workspace_select
  ON public.company_attachments FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert
  ON public.company_attachments FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update
  ON public.company_attachments FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete
  ON public.company_attachments FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

-- Storage bucket prive (telecharge cote serveur via service role pour
-- joindre aux emails). On autorise aussi l'utilisateur a uploader/supprimer
-- ses propres fichiers depuis le navigateur.
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-attachments', 'company-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS workspace_select_company_attachments ON storage.objects;
DROP POLICY IF EXISTS workspace_insert_company_attachments ON storage.objects;
DROP POLICY IF EXISTS workspace_update_company_attachments ON storage.objects;
DROP POLICY IF EXISTS workspace_delete_company_attachments ON storage.objects;

CREATE POLICY workspace_select_company_attachments
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-attachments'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_insert_company_attachments
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-attachments'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_update_company_attachments
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-attachments'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  )
  WITH CHECK (
    bucket_id = 'company-attachments'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_delete_company_attachments
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-attachments'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );
