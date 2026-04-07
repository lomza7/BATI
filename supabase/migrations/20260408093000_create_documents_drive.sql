-- ============================================================
-- Mes documents: simple drive with folders + files
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  parent_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  visibility text NOT NULL DEFAULT 'private',
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_folders_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT document_folders_source_check CHECK (source IN ('manual', 'project')),
  CONSTRAINT document_folders_visibility_check CHECK (visibility IN ('private', 'workspace')),
  CONSTRAINT document_folders_unique_name_per_parent UNIQUE NULLS NOT DISTINCT (user_id, parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_document_folders_user_parent
  ON public.document_folders(user_id, parent_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_folders_project_root
  ON public.document_folders(project_id)
  WHERE project_id IS NOT NULL AND source = 'project';

CREATE TABLE IF NOT EXISTS public.document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  folder_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  project_photo_id uuid REFERENCES public.project_photos(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'documents',
  visibility text NOT NULL DEFAULT 'private',
  name text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_files_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT document_files_storage_bucket_check CHECK (storage_bucket IN ('documents', 'project-photos')),
  CONSTRAINT document_files_visibility_check CHECK (visibility IN ('private', 'workspace')),
  CONSTRAINT document_files_storage_path_not_empty CHECK (char_length(trim(storage_path)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_document_files_user_folder
  ON public.document_files(user_id, folder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_files_project
  ON public.document_files(project_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_files_project_photo
  ON public.document_files(project_photo_id)
  WHERE project_photo_id IS NOT NULL;

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.document_folders;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.document_folders
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.document_files;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.document_files
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS workspace_select ON public.document_folders;
DROP POLICY IF EXISTS workspace_insert ON public.document_folders;
DROP POLICY IF EXISTS workspace_update ON public.document_folders;
DROP POLICY IF EXISTS workspace_delete ON public.document_folders;

CREATE POLICY workspace_select
  ON public.document_folders FOR SELECT TO authenticated
  USING (
    user_id = public.current_workspace_user_id()
    OR (public.has_workspace_access(user_id) AND visibility = 'workspace')
  );

CREATE POLICY workspace_insert
  ON public.document_folders FOR INSERT TO authenticated
  WITH CHECK (
    public.current_workspace_user_id() = user_id
    AND (
      parent_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.document_folders parent
        WHERE parent.id = document_folders.parent_id
          AND parent.user_id = public.current_workspace_user_id()
      )
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.projects project
        WHERE project.id = document_folders.project_id
          AND project.user_id = public.current_workspace_user_id()
      )
    )
  );

CREATE POLICY workspace_update
  ON public.document_folders FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (
    public.current_workspace_user_id() = user_id
    AND (
      parent_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.document_folders parent
        WHERE parent.id = document_folders.parent_id
          AND parent.user_id = public.current_workspace_user_id()
      )
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.projects project
        WHERE project.id = document_folders.project_id
          AND project.user_id = public.current_workspace_user_id()
      )
    )
  );

CREATE POLICY workspace_delete
  ON public.document_folders FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

DROP POLICY IF EXISTS workspace_select ON public.document_files;
DROP POLICY IF EXISTS workspace_insert ON public.document_files;
DROP POLICY IF EXISTS workspace_update ON public.document_files;
DROP POLICY IF EXISTS workspace_delete ON public.document_files;

CREATE POLICY workspace_select
  ON public.document_files FOR SELECT TO authenticated
  USING (
    user_id = public.current_workspace_user_id()
    OR (public.has_workspace_access(user_id) AND visibility = 'workspace')
  );

CREATE POLICY workspace_insert
  ON public.document_files FOR INSERT TO authenticated
  WITH CHECK (
    public.current_workspace_user_id() = user_id
    AND (
      folder_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.document_folders folder
        WHERE folder.id = document_files.folder_id
          AND folder.user_id = public.current_workspace_user_id()
      )
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.projects project
        WHERE project.id = document_files.project_id
          AND project.user_id = public.current_workspace_user_id()
      )
    )
  );

CREATE POLICY workspace_update
  ON public.document_files FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (
    public.current_workspace_user_id() = user_id
    AND (
      folder_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.document_folders folder
        WHERE folder.id = document_files.folder_id
          AND folder.user_id = public.current_workspace_user_id()
      )
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.projects project
        WHERE project.id = document_files.project_id
          AND project.user_id = public.current_workspace_user_id()
      )
    )
  );

CREATE POLICY workspace_delete
  ON public.document_files FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS workspace_select_documents ON storage.objects;
DROP POLICY IF EXISTS workspace_insert_documents ON storage.objects;
DROP POLICY IF EXISTS workspace_update_documents ON storage.objects;
DROP POLICY IF EXISTS workspace_delete_documents ON storage.objects;

CREATE POLICY workspace_select_documents
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_insert_documents
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_update_documents
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_delete_documents
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

DROP POLICY IF EXISTS "Auth users can upload project photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update project photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete project photos" ON storage.objects;

CREATE POLICY "Auth users can upload project photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY "Auth users can update project photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  )
  WITH CHECK (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY "Auth users can delete project photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );
