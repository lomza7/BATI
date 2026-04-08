-- ============================================================
-- Storage quotas per plan: 5 Go starter / 10 Go pro / 20 Go business
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_workspace_storage_used(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(size_bytes), 0)::bigint
  FROM public.document_files
  WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_storage_quota_for_plan(p_plan text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(COALESCE(p_plan, 'starter'))
    WHEN 'business' THEN (20::bigint * 1024 * 1024 * 1024)
    WHEN 'pro'      THEN (10::bigint * 1024 * 1024 * 1024)
    ELSE                 (5::bigint  * 1024 * 1024 * 1024)
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_quota bigint;
  v_used bigint;
BEGIN
  -- Project photos sync into documents but use the project-photos bucket;
  -- they don't count against the documents quota.
  IF NEW.storage_bucket = 'project-photos' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(plan, 'starter') INTO v_plan
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_quota := public.get_storage_quota_for_plan(v_plan);
  v_used := public.get_workspace_storage_used(NEW.user_id);

  IF v_used + COALESCE(NEW.size_bytes, 0) > v_quota THEN
    RAISE EXCEPTION 'STORAGE_QUOTA_EXCEEDED: Quota de % Go atteint pour le plan %', (v_quota / 1024 / 1024 / 1024), v_plan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_storage_quota_before_insert ON public.document_files;
CREATE TRIGGER check_storage_quota_before_insert
BEFORE INSERT ON public.document_files
FOR EACH ROW
EXECUTE FUNCTION public.enforce_storage_quota();
