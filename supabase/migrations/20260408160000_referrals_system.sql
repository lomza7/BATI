-- ============================================================
-- Referrals system (Lien de parrainage)
-- 1. referral_codes : one short code per user
-- 2. referral_invites : track each email sent (opens included)
-- 3. referral_signups : link a new user to the referrer + reward state
-- 4. profiles.pending_referral_code + referral_credit_months
-- 5. RPCs : get_or_create_referral_code, get_admin_referral_*
-- ============================================================

-- ============================================================
-- 1. profiles columns
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_referral_code text,
  ADD COLUMN IF NOT EXISTS referral_credit_months int NOT NULL DEFAULT 0;

-- ============================================================
-- 2. referral_codes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_code_format CHECK (char_length(code) BETWEEN 6 AND 16)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_codes_select_own ON public.referral_codes;
CREATE POLICY referral_codes_select_own
  ON public.referral_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS referral_codes_insert_own ON public.referral_codes;
CREATE POLICY referral_codes_insert_own
  ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. referral_invites (emails sent + open tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text DEFAULT '',
  subject text DEFAULT '',
  message text DEFAULT '',
  tracking_token text NOT NULL UNIQUE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  open_count int NOT NULL DEFAULT 0,
  signed_up_at timestamptz,
  signed_up_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT referral_invites_email_not_empty CHECK (char_length(trim(recipient_email)) > 0),
  CONSTRAINT referral_invites_token_length CHECK (char_length(tracking_token) >= 20)
);

CREATE INDEX IF NOT EXISTS idx_referral_invites_referrer
  ON public.referral_invites(referrer_user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_invites_token
  ON public.referral_invites(tracking_token);
CREATE INDEX IF NOT EXISTS idx_referral_invites_email
  ON public.referral_invites(lower(recipient_email));

ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_invites_select_own ON public.referral_invites;
CREATE POLICY referral_invites_select_own
  ON public.referral_invites FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid());

DROP POLICY IF EXISTS referral_invites_insert_own ON public.referral_invites;
CREATE POLICY referral_invites_insert_own
  ON public.referral_invites FOR INSERT TO authenticated
  WITH CHECK (referrer_user_id = auth.uid());

DROP POLICY IF EXISTS referral_invites_delete_own ON public.referral_invites;
CREATE POLICY referral_invites_delete_own
  ON public.referral_invites FOR DELETE TO authenticated
  USING (referrer_user_id = auth.uid());

-- ============================================================
-- 4. referral_signups (referrer ↔ referred + reward state)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  code text NOT NULL,
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  subscribed_at timestamptz,
  subscription_plan text,
  referrer_credit_granted boolean NOT NULL DEFAULT false,
  referrer_credit_granted_at timestamptz,
  referred_credit_granted boolean NOT NULL DEFAULT false,
  referred_credit_granted_at timestamptz,
  notes text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_referral_signups_referrer
  ON public.referral_signups(referrer_user_id, signed_up_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_signups_referred
  ON public.referral_signups(referred_user_id);

ALTER TABLE public.referral_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_signups_select_referrer ON public.referral_signups;
CREATE POLICY referral_signups_select_referrer
  ON public.referral_signups FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

-- ============================================================
-- 5. RPCs
-- ============================================================

-- Returns existing code or creates a new short alphanumeric code
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
  v_attempts int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = v_user_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  LOOP
    -- 8-char uppercase code, no ambiguous chars (0/O, 1/I)
    v_code := upper(translate(substring(encode(gen_random_bytes(8), 'base64') from 1 for 8), '+/=OI01lo', 'ABCDEFGHJ'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Impossible de generer un code unique';
    END IF;
  END LOOP;

  INSERT INTO public.referral_codes (user_id, code) VALUES (v_user_id, v_code);
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;

-- Per-user stats for the parrainage page
CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT jsonb_build_object(
    'invites_sent', (
      SELECT COUNT(*) FROM public.referral_invites WHERE referrer_user_id = v_user_id
    ),
    'invites_opened', (
      SELECT COUNT(*) FROM public.referral_invites
      WHERE referrer_user_id = v_user_id AND opened_at IS NOT NULL
    ),
    'signups', (
      SELECT COUNT(*) FROM public.referral_signups WHERE referrer_user_id = v_user_id
    ),
    'subscribed', (
      SELECT COUNT(*) FROM public.referral_signups
      WHERE referrer_user_id = v_user_id AND subscribed_at IS NOT NULL
    ),
    'months_earned', COALESCE((
      SELECT referral_credit_months FROM public.profiles WHERE id = v_user_id
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;

-- Admin: aggregated referral KPIs
CREATE OR REPLACE FUNCTION public.get_admin_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email <> 'louis@maaza.pro' THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  SELECT jsonb_build_object(
    'codes_total', (SELECT COUNT(*) FROM public.referral_codes),
    'invites_total', (SELECT COUNT(*) FROM public.referral_invites),
    'invites_opened', (SELECT COUNT(*) FROM public.referral_invites WHERE opened_at IS NOT NULL),
    'signups_total', (SELECT COUNT(*) FROM public.referral_signups),
    'subscribed_total', (SELECT COUNT(*) FROM public.referral_signups WHERE subscribed_at IS NOT NULL),
    'months_credited', (SELECT COALESCE(SUM(referral_credit_months), 0) FROM public.profiles)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_referral_stats() TO authenticated;

-- Admin: list of referrers + their numbers
CREATE OR REPLACE FUNCTION public.get_admin_referrals()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  company_name text,
  code text,
  invites_sent bigint,
  invites_opened bigint,
  signups bigint,
  subscribed bigint,
  months_earned int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email <> 'louis@maaza.pro' THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  RETURN QUERY
  SELECT
    rc.user_id,
    u.email::text,
    p.full_name,
    p.company_name,
    rc.code,
    (SELECT COUNT(*) FROM public.referral_invites ri WHERE ri.referrer_user_id = rc.user_id),
    (SELECT COUNT(*) FROM public.referral_invites ri WHERE ri.referrer_user_id = rc.user_id AND ri.opened_at IS NOT NULL),
    (SELECT COUNT(*) FROM public.referral_signups rs WHERE rs.referrer_user_id = rc.user_id),
    (SELECT COUNT(*) FROM public.referral_signups rs WHERE rs.referrer_user_id = rc.user_id AND rs.subscribed_at IS NOT NULL),
    COALESCE(p.referral_credit_months, 0)
  FROM public.referral_codes rc
  JOIN auth.users u ON u.id = rc.user_id
  LEFT JOIN public.profiles p ON p.id = rc.user_id
  ORDER BY (SELECT COUNT(*) FROM public.referral_signups rs WHERE rs.referrer_user_id = rc.user_id) DESC,
           rc.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_referrals() TO authenticated;
