-- ============================================================
-- Auto-create document folders for projects + sync project_photos
-- Backfills existing data
-- ============================================================

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.document_folders;
DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.document_files;

CREATE OR REPLACE FUNCTION public.build_unique_root_folder_name(p_user_id uuid, p_base_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text := COALESCE(NULLIF(trim(p_base_name), ''), 'Chantier');
  v_candidate text := v_base;
  v_counter int := 2;
BEGIN
  WHILE EXISTS (
    SELECT 1 FROM public.document_folders
    WHERE user_id = p_user_id
      AND parent_id IS NULL
      AND lower(name) = lower(v_candidate)
  ) LOOP
    v_candidate := v_base || ' (' || v_counter || ')';
    v_counter := v_counter + 1;
  END LOOP;
  RETURN v_candidate;
END;
$$;

-- Backfill folders for existing projects
INSERT INTO public.document_folders (user_id, parent_id, project_id, source, visibility, name)
SELECT
  p.user_id, NULL, p.id, 'project', 'workspace',
  public.build_unique_root_folder_name(p.user_id, p.name)
FROM public.projects p
WHERE p.deleted_at IS NULL
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.document_folders f
    WHERE f.project_id = p.id AND f.source = 'project'
  );

-- Backfill files (photos)
INSERT INTO public.document_files (
  user_id, folder_id, project_id, project_photo_id,
  storage_bucket, visibility, name, original_name,
  mime_type, size_bytes, storage_path
)
SELECT
  ph.user_id, f.id, ph.project_id, ph.id,
  'project-photos', 'workspace',
  COALESCE(NULLIF(ph.caption, ''), regexp_replace(substring(ph.url FROM position('/storage/v1/object/public/project-photos/' IN ph.url) + length('/storage/v1/object/public/project-photos/')), '^.*/', '')),
  regexp_replace(substring(ph.url FROM position('/storage/v1/object/public/project-photos/' IN ph.url) + length('/storage/v1/object/public/project-photos/')), '^.*/', ''),
  'image/jpeg', 0,
  substring(ph.url FROM position('/storage/v1/object/public/project-photos/' IN ph.url) + length('/storage/v1/object/public/project-photos/'))
FROM public.project_photos ph
JOIN public.document_folders f ON f.project_id = ph.project_id AND f.source = 'project'
WHERE ph.user_id IS NOT NULL
  AND position('/storage/v1/object/public/project-photos/' IN ph.url) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.document_files df WHERE df.project_photo_id = ph.id
  );

CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.document_folders
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.document_files
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

-- ============================================================
-- Auto-creation triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_project_document_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_name text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.document_folders
  WHERE project_id = NEW.id AND source = 'project'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_name := public.build_unique_root_folder_name(NEW.user_id, NEW.name);

  INSERT INTO public.document_folders (
    user_id, parent_id, project_id, source, visibility, name
  ) VALUES (
    NEW.user_id, NULL, NEW.id, 'project', 'workspace', v_name
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_document_folder_after_project_insert ON public.projects;
CREATE TRIGGER create_document_folder_after_project_insert
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.ensure_project_document_folder();

CREATE OR REPLACE FUNCTION public.rename_project_document_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder_id uuid;
  v_new_name text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_folder_id
  FROM public.document_folders
  WHERE project_id = NEW.id AND source = 'project'
  LIMIT 1;

  IF v_folder_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_name := public.build_unique_root_folder_name(NEW.user_id, NEW.name);

  UPDATE public.document_folders SET name = v_new_name, updated_at = now() WHERE id = v_folder_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rename_document_folder_after_project_update ON public.projects;
CREATE TRIGGER rename_document_folder_after_project_update
AFTER UPDATE OF name ON public.projects
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.rename_project_document_folder();

CREATE OR REPLACE FUNCTION public.sync_project_photo_to_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder_id uuid;
  v_project_name text;
  v_storage_path text;
  v_marker text := '/storage/v1/object/public/project-photos/';
  v_marker_pos int;
  v_filename text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_folder_id
  FROM public.document_folders
  WHERE project_id = NEW.project_id AND source = 'project'
  LIMIT 1;

  IF v_folder_id IS NULL THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = NEW.project_id;

    INSERT INTO public.document_folders (
      user_id, parent_id, project_id, source, visibility, name
    ) VALUES (
      NEW.user_id, NULL, NEW.project_id, 'project', 'workspace',
      public.build_unique_root_folder_name(NEW.user_id, COALESCE(v_project_name, 'Chantier'))
    )
    RETURNING id INTO v_folder_id;
  END IF;

  v_marker_pos := position(v_marker IN NEW.url);
  IF v_marker_pos = 0 THEN
    RETURN NEW;
  END IF;

  v_storage_path := substring(NEW.url FROM v_marker_pos + length(v_marker));
  v_filename := regexp_replace(v_storage_path, '^.*/', '');

  IF EXISTS (SELECT 1 FROM public.document_files WHERE project_photo_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.document_files (
    user_id, folder_id, project_id, project_photo_id,
    storage_bucket, visibility, name, original_name,
    mime_type, size_bytes, storage_path
  ) VALUES (
    NEW.user_id, v_folder_id, NEW.project_id, NEW.id,
    'project-photos', 'workspace',
    COALESCE(NULLIF(NEW.caption, ''), v_filename), v_filename,
    'image/jpeg', 0, v_storage_path
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_photo_to_documents_after_insert ON public.project_photos;
CREATE TRIGGER sync_photo_to_documents_after_insert
AFTER INSERT ON public.project_photos
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_photo_to_documents();
