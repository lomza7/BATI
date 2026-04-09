-- ============================================================
-- Avant/Apres IA — Campaign system (lead magnet)
--
-- 1. rendu_campaigns: each personalized link an artisan creates
-- 2. rendu_leads: prospects captured on the public page (email + name)
-- 3. rendu_generations: each AI before/after a lead generated
-- 4. Storage bucket "rendu-images" for before/after files
--
-- All public access goes through API routes using the service role,
-- so we don't expose anon RLS on these tables. Workspace owners get
-- the standard workspace RLS policies (current_workspace_user_id +
-- has_workspace_access + enforce_workspace_user_id trigger).
-- ============================================================

-- ============================================================
-- 1. rendu_campaigns
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rendu_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  token text UNIQUE NOT NULL,
  campaign_name text NOT NULL DEFAULT '',
  prefilled_client_name text DEFAULT '',
  prefilled_client_email text DEFAULT '',
  project_type text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  view_count int NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rendu_campaigns_token_length CHECK (char_length(token) >= 16),
  CONSTRAINT rendu_campaigns_status_check CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_rendu_campaigns_user
  ON public.rendu_campaigns(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rendu_campaigns_token
  ON public.rendu_campaigns(token)
  WHERE status = 'active';

ALTER TABLE public.rendu_campaigns ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.rendu_campaigns;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.rendu_campaigns
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS workspace_select ON public.rendu_campaigns;
DROP POLICY IF EXISTS workspace_insert ON public.rendu_campaigns;
DROP POLICY IF EXISTS workspace_update ON public.rendu_campaigns;
DROP POLICY IF EXISTS workspace_delete ON public.rendu_campaigns;

CREATE POLICY workspace_select
  ON public.rendu_campaigns FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert
  ON public.rendu_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update
  ON public.rendu_campaigns FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete
  ON public.rendu_campaigns FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

-- ============================================================
-- 2. rendu_leads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rendu_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.rendu_campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  lead_name text NOT NULL DEFAULT '',
  lead_email text NOT NULL,
  session_token text UNIQUE NOT NULL,
  generation_count int NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rendu_leads_email_not_empty CHECK (char_length(trim(lead_email)) > 0),
  CONSTRAINT rendu_leads_session_token_length CHECK (char_length(session_token) >= 24)
);

CREATE INDEX IF NOT EXISTS idx_rendu_leads_campaign
  ON public.rendu_leads(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rendu_leads_user
  ON public.rendu_leads(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rendu_leads_session_token
  ON public.rendu_leads(session_token);

ALTER TABLE public.rendu_leads ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.rendu_leads;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.rendu_leads
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS workspace_select ON public.rendu_leads;
DROP POLICY IF EXISTS workspace_insert ON public.rendu_leads;
DROP POLICY IF EXISTS workspace_update ON public.rendu_leads;
DROP POLICY IF EXISTS workspace_delete ON public.rendu_leads;

CREATE POLICY workspace_select
  ON public.rendu_leads FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert
  ON public.rendu_leads FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update
  ON public.rendu_leads FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete
  ON public.rendu_leads FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

-- ============================================================
-- 3. rendu_generations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rendu_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.rendu_leads(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.rendu_campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  room_type text DEFAULT '',
  style text DEFAULT '',
  before_path text NOT NULL,
  after_path text NOT NULL,
  before_url text NOT NULL,
  after_url text NOT NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  provider text DEFAULT '',
  model text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rendu_generations_lead
  ON public.rendu_generations(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rendu_generations_campaign
  ON public.rendu_generations(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rendu_generations_user
  ON public.rendu_generations(user_id, created_at DESC);

ALTER TABLE public.rendu_generations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.rendu_generations;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.rendu_generations
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS workspace_select ON public.rendu_generations;
DROP POLICY IF EXISTS workspace_insert ON public.rendu_generations;
DROP POLICY IF EXISTS workspace_update ON public.rendu_generations;
DROP POLICY IF EXISTS workspace_delete ON public.rendu_generations;

CREATE POLICY workspace_select
  ON public.rendu_generations FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert
  ON public.rendu_generations FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update
  ON public.rendu_generations FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete
  ON public.rendu_generations FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

-- ============================================================
-- 4. Storage bucket "rendu-images"
--
-- Public bucket so the visitor on /r/[token] can fetch the
-- generated images directly. Path layout:
--   {owner_user_id}/{campaign_id}/{lead_id}/{generation_id}-before.jpg
--   {owner_user_id}/{campaign_id}/{lead_id}/{generation_id}-after.png
-- Workspace owners can manage their own folder via standard
-- workspace policies; public read is allowed by the bucket flag.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('rendu-images', 'rendu-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS workspace_select_rendu_images ON storage.objects;
DROP POLICY IF EXISTS workspace_insert_rendu_images ON storage.objects;
DROP POLICY IF EXISTS workspace_update_rendu_images ON storage.objects;
DROP POLICY IF EXISTS workspace_delete_rendu_images ON storage.objects;

CREATE POLICY workspace_select_rendu_images
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rendu-images'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_insert_rendu_images
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rendu-images'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_update_rendu_images
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rendu-images'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  )
  WITH CHECK (
    bucket_id = 'rendu-images'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_delete_rendu_images
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'rendu-images'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );
