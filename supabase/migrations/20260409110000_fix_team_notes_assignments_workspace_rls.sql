/*
  # Fix team_notes / team_assignments RLS — workspace-scoped policies

  The original migration `20260330100000_extend_team_members.sql` created both tables with
  `CREATE POLICY ... FOR ALL TO authenticated USING (true) WITH CHECK (true)`, which exposed
  every workspace's HR notes and labor hours to any authenticated user (read, write, delete).

  The workspace migration `20260406193000_create_workspace_team.sql` skipped these tables
  because they had no `user_id` column to scope on, so they were never patched in git.

  Production was hot-patched out-of-band. This migration brings the git history back in sync
  and is fully idempotent so it can run on any environment (fresh, partially patched, or
  already fixed).

  Steps per table:
    1. Add `user_id` column if missing
    2. Backfill from `team_members.user_id` via the existing FK
    3. Drop any orphan rows that can't be assigned (defensive — shouldn't happen in practice)
    4. SET NOT NULL + workspace default + enforcement trigger
    5. Drop legacy policies (`USING (true)` + any auth.uid-based duplicates)
    6. Recreate workspace_select / insert / update / delete using `has_workspace_access()`
*/

-- ============================================================
-- team_notes
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_notes' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.team_notes
      ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.team_notes tn
SET user_id = tm.user_id
FROM public.team_members tm
WHERE tn.team_member_id = tm.id
  AND tn.user_id IS NULL
  AND tm.user_id IS NOT NULL;

-- Defensive: orphaned notes whose team_member has no owner cannot be scoped to a workspace
DELETE FROM public.team_notes WHERE user_id IS NULL;

ALTER TABLE public.team_notes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.team_notes ALTER COLUMN user_id SET DEFAULT public.current_workspace_user_id();

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.team_notes;
CREATE TRIGGER set_workspace_user_id_before_write
  BEFORE INSERT OR UPDATE ON public.team_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS "Auth users can manage team notes" ON public.team_notes;
DROP POLICY IF EXISTS "Users can view own team_notes" ON public.team_notes;
DROP POLICY IF EXISTS "Users can insert own team_notes" ON public.team_notes;
DROP POLICY IF EXISTS "Users can update own team_notes" ON public.team_notes;
DROP POLICY IF EXISTS "Users can delete own team_notes" ON public.team_notes;
DROP POLICY IF EXISTS workspace_select ON public.team_notes;
DROP POLICY IF EXISTS workspace_insert ON public.team_notes;
DROP POLICY IF EXISTS workspace_update ON public.team_notes;
DROP POLICY IF EXISTS workspace_delete ON public.team_notes;

CREATE POLICY workspace_select ON public.team_notes
  FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert ON public.team_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update ON public.team_notes
  FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete ON public.team_notes
  FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE INDEX IF NOT EXISTS idx_team_notes_user_id ON public.team_notes(user_id);

-- ============================================================
-- team_assignments
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_assignments' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.team_assignments
      ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.team_assignments ta
SET user_id = tm.user_id
FROM public.team_members tm
WHERE ta.team_member_id = tm.id
  AND ta.user_id IS NULL
  AND tm.user_id IS NOT NULL;

DELETE FROM public.team_assignments WHERE user_id IS NULL;

ALTER TABLE public.team_assignments ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.team_assignments ALTER COLUMN user_id SET DEFAULT public.current_workspace_user_id();

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.team_assignments;
CREATE TRIGGER set_workspace_user_id_before_write
  BEFORE INSERT OR UPDATE ON public.team_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS "Auth users can manage team assignments" ON public.team_assignments;
DROP POLICY IF EXISTS "Users can view own team_assignments" ON public.team_assignments;
DROP POLICY IF EXISTS "Users can insert own team_assignments" ON public.team_assignments;
DROP POLICY IF EXISTS "Users can update own team_assignments" ON public.team_assignments;
DROP POLICY IF EXISTS "Users can delete own team_assignments" ON public.team_assignments;
DROP POLICY IF EXISTS workspace_select ON public.team_assignments;
DROP POLICY IF EXISTS workspace_insert ON public.team_assignments;
DROP POLICY IF EXISTS workspace_update ON public.team_assignments;
DROP POLICY IF EXISTS workspace_delete ON public.team_assignments;

CREATE POLICY workspace_select ON public.team_assignments
  FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert ON public.team_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update ON public.team_assignments
  FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete ON public.team_assignments
  FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE INDEX IF NOT EXISTS idx_team_assignments_user_id ON public.team_assignments(user_id);
