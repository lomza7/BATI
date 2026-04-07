CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure profiles.plan column exists (needed by workspace_team_feature_enabled)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter';

CREATE TABLE IF NOT EXISTS public.workspace_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email text NOT NULL,
  role text NOT NULL DEFAULT 'commercial',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_token uuid NOT NULL DEFAULT gen_random_uuid(),
  note text DEFAULT '',
  last_seen_at timestamptz,
  last_active_path text DEFAULT '',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_memberships_role_check CHECK (
    role IN ('admin', 'chef_equipe', 'commercial', 'assistante', 'conducteur_travaux')
  ),
  CONSTRAINT workspace_memberships_status_check CHECK (
    status IN ('pending', 'active', 'revoked')
  ),
  CONSTRAINT workspace_memberships_no_self CHECK (
    member_user_id IS NULL OR member_user_id <> owner_user_id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_memberships_owner_email
  ON public.workspace_memberships(owner_user_id, invited_email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_memberships_member_active
  ON public.workspace_memberships(member_user_id)
  WHERE member_user_id IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_owner_status
  ON public.workspace_memberships(owner_user_id, status);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_last_seen
  ON public.workspace_memberships(owner_user_id, last_seen_at DESC);

ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.workspace_team_feature_enabled(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT plan <> 'starter'
      FROM public.profiles
      WHERE id = p_owner_user_id
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT wm.owner_user_id
      FROM public.workspace_memberships wm
      WHERE wm.member_user_id = auth.uid()
        AND wm.status = 'active'
        AND public.workspace_team_feature_enabled(wm.owner_user_id)
      ORDER BY wm.accepted_at NULLS LAST, wm.created_at ASC
      LIMIT 1
    ),
    auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT wm.role
      FROM public.workspace_memberships wm
      WHERE wm.member_user_id = auth.uid()
        AND wm.status = 'active'
        AND public.workspace_team_feature_enabled(wm.owner_user_id)
      ORDER BY wm.accepted_at NULLS LAST, wm.created_at ASC
      LIMIT 1
    ),
    'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_access(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      auth.uid() = p_owner_user_id
      OR EXISTS (
        SELECT 1
        FROM public.workspace_memberships wm
        WHERE wm.owner_user_id = p_owner_user_id
          AND wm.member_user_id = auth.uid()
          AND wm.status = 'active'
          AND public.workspace_team_feature_enabled(p_owner_user_id)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace_team(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.workspace_team_feature_enabled(p_owner_user_id)
    AND (
      auth.uid() = p_owner_user_id
      OR EXISTS (
        SELECT 1
        FROM public.workspace_memberships wm
        WHERE wm.owner_user_id = p_owner_user_id
          AND wm.member_user_id = auth.uid()
          AND wm.status = 'active'
          AND wm.role = 'admin'
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.normalize_workspace_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.invited_email := lower(trim(NEW.invited_email));
  NEW.updated_at := now();

  IF NEW.status = 'active' AND NEW.accepted_at IS NULL THEN
    NEW.accepted_at := now();
  END IF;

  IF NEW.status <> 'active' THEN
    NEW.last_active_path := COALESCE(NEW.last_active_path, '');
    NEW.last_seen_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_workspace_membership_before_write ON public.workspace_memberships;
CREATE TRIGGER normalize_workspace_membership_before_write
BEFORE INSERT OR UPDATE ON public.workspace_memberships
FOR EACH ROW EXECUTE FUNCTION public.normalize_workspace_membership();

-- Helper to check admin membership (SECURITY DEFINER bypasses RLS, avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_admin_of(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_memberships wm
    WHERE wm.owner_user_id = p_owner_user_id
      AND wm.member_user_id = auth.uid()
      AND wm.status = 'active'
      AND wm.role = 'admin'
      AND public.workspace_team_feature_enabled(p_owner_user_id)
  );
$$;

DROP POLICY IF EXISTS workspace_memberships_select ON public.workspace_memberships;
DROP POLICY IF EXISTS workspace_memberships_insert ON public.workspace_memberships;
DROP POLICY IF EXISTS workspace_memberships_update ON public.workspace_memberships;
DROP POLICY IF EXISTS workspace_memberships_delete ON public.workspace_memberships;

CREATE POLICY workspace_memberships_select
  ON public.workspace_memberships FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_user_id
    OR member_user_id = auth.uid()
    OR public.is_workspace_admin_of(owner_user_id)
  );

CREATE POLICY workspace_memberships_insert
  ON public.workspace_memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_workspace_team(owner_user_id)
    AND public.current_workspace_user_id() = owner_user_id
  );

CREATE POLICY workspace_memberships_update
  ON public.workspace_memberships FOR UPDATE TO authenticated
  USING (public.can_manage_workspace_team(owner_user_id))
  WITH CHECK (public.can_manage_workspace_team(owner_user_id));

CREATE POLICY workspace_memberships_delete
  ON public.workspace_memberships FOR DELETE TO authenticated
  USING (public.can_manage_workspace_team(owner_user_id));

CREATE OR REPLACE FUNCTION public.enforce_workspace_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := public.current_workspace_user_id();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
  target_tables text[] := ARRAY[
    'clients',
    'quotes',
    'quote_lines',
    'invoices',
    'invoice_lines',
    'projects',
    'project_photos',
    'team_members',
    'planning_events',
    'leads',
    'reviews',
    'ai_agents',
    'ai_conversations',
    'ai_messages',
    'recurring_contracts',
    'expenses',
    'team_notes',
    'team_assignments',
    'todos',
    'services',
    'business_reminder_settings',
    'lead_sources',
    'lead_stages',
    'quote_sends',
    'invoice_sends',
    'devis',
    'factures',
    'chantiers'
  ];
BEGIN
  FOREACH tbl IN ARRAY target_tables LOOP
    -- Skip tables that don't exist or don't have a user_id column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT public.current_workspace_user_id()',
      tbl
    );
    EXECUTE format('DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER set_workspace_user_id_before_write BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id()',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS workspace_select ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS workspace_insert ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS workspace_update ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS workspace_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY workspace_select ON public.%I FOR SELECT TO authenticated USING (public.has_workspace_access(user_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY workspace_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.current_workspace_user_id() = user_id)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY workspace_update ON public.%I FOR UPDATE TO authenticated USING (public.has_workspace_access(user_id)) WITH CHECK (public.current_workspace_user_id() = user_id)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY workspace_delete ON public.%I FOR DELETE TO authenticated USING (public.has_workspace_access(user_id))',
      tbl
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_email text := lower(coalesce(NEW.email, ''));
  has_pending_invite boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_memberships wm
    WHERE wm.invited_email = v_invited_email
      AND wm.member_user_id IS NULL
      AND wm.status = 'pending'
  )
  INTO has_pending_invite;

  INSERT INTO public.profiles (id, onboarding_completed)
  VALUES (NEW.id, has_pending_invite)
  ON CONFLICT (id) DO UPDATE
    SET onboarding_completed = public.profiles.onboarding_completed OR EXCLUDED.onboarding_completed;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_reminder_settings') THEN
    EXECUTE 'INSERT INTO public.business_reminder_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING' USING NEW.id;
  END IF;

  -- Call seed functions only if they exist (dynamic SQL to avoid compile-time check)
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_ai_agents_for_user') THEN
    EXECUTE 'SELECT public.seed_ai_agents_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_default_lead_sources_for_user') THEN
    EXECUTE 'SELECT public.seed_default_lead_sources_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_default_lead_stages_for_user') THEN
    EXECUTE 'SELECT public.seed_default_lead_stages_for_user($1)' USING NEW.id;
  END IF;

  UPDATE public.workspace_memberships
  SET member_user_id = NEW.id,
      status = 'active',
      accepted_at = now(),
      updated_at = now()
  WHERE invited_email = v_invited_email
    AND member_user_id IS NULL
    AND status = 'pending';

  RETURN NEW;
END;
$$;
