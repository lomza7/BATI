-- ============================================================
-- Email verification system
-- Users created via normal signup must enter a 6-digit code
-- emailed via Resend before they can access the app.
-- Users created via a workspace team invite are auto-verified.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Backfill existing users so they are not locked out
UPDATE public.profiles
SET email_verified = true
WHERE email_verified = false;

ALTER TABLE public.profiles
  ALTER COLUMN email_verified SET DEFAULT false;

CREATE TABLE IF NOT EXISTS public.email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verifications_user_id_idx ON public.email_verifications(user_id);
CREATE INDEX IF NOT EXISTS email_verifications_expires_at_idx ON public.email_verifications(expires_at);

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access" ON public.email_verifications;
CREATE POLICY "No direct access" ON public.email_verifications FOR ALL USING (false) WITH CHECK (false);

-- handle_new_user sets email_verified = has_pending_invite so workspace
-- invites skip the extra step and normal signups start unverified.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  INSERT INTO public.profiles (id, onboarding_completed, email_verified)
  VALUES (NEW.id, has_pending_invite, has_pending_invite)
  ON CONFLICT (id) DO UPDATE
    SET onboarding_completed = public.profiles.onboarding_completed OR EXCLUDED.onboarding_completed,
        email_verified = public.profiles.email_verified OR EXCLUDED.email_verified;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_reminder_settings') THEN
    EXECUTE 'INSERT INTO public.business_reminder_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING' USING NEW.id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_ai_agents_for_user') THEN
    EXECUTE 'SELECT public.seed_ai_agents_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_default_lead_sources_for_user') THEN
    EXECUTE 'SELECT public.seed_default_lead_sources_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_default_lead_stages_for_user') THEN
    EXECUTE 'SELECT public.seed_default_lead_stages_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_expense_categories_for_user') THEN
    EXECUTE 'SELECT public.seed_expense_categories_for_user($1)' USING NEW.id;
  END IF;

  UPDATE public.workspace_memberships
  SET member_user_id = NEW.id,
      status = 'active',
      accepted_at = now(),
      updated_at = now()
  WHERE invited_email = v_invited_email
    AND member_user_id IS NULL
    AND status = 'pending';

  IF NOT has_pending_invite THEN
    BEGIN
      PERFORM public.seed_demo_data_for_user(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'seed_demo_data_for_user failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$fn$;
