-- Phase 8.3 — Remplace les checks email='louis@maaza.pro' codés en dur
-- par is_admin() dans les policies et fonctions admin. Les signatures
-- et les corps existants sont préservés à l'identique hors du check.

-- platform_config
DROP POLICY IF EXISTS "Admin can manage config" ON platform_config;
CREATE POLICY "Admin can manage config" ON platform_config
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- platform_secrets
DROP POLICY IF EXISTS "Admin can read secrets" ON platform_secrets;
DROP POLICY IF EXISTS "Admin can manage secrets" ON platform_secrets;
CREATE POLICY "Admin can read secrets" ON platform_secrets
  FOR SELECT TO authenticated
  USING (is_admin());
CREATE POLICY "Admin can manage secrets" ON platform_secrets
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- get_admin_stats
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM auth.users),
    'users_today', (SELECT count(*) FROM auth.users WHERE created_at >= CURRENT_DATE),
    'users_this_week', (SELECT count(*) FROM auth.users WHERE created_at >= date_trunc('week', CURRENT_DATE)),
    'users_this_month', (SELECT count(*) FROM auth.users WHERE created_at >= date_trunc('month', CURRENT_DATE)),
    'users_this_year', (SELECT count(*) FROM auth.users WHERE created_at >= date_trunc('year', CURRENT_DATE)),
    'onboarding_completed', (SELECT count(*) FROM profiles WHERE onboarding_completed = true),
    'plan_starter', (SELECT count(*) FROM profiles WHERE plan = 'starter'),
    'plan_pro', (SELECT count(*) FROM profiles WHERE plan = 'pro'),
    'plan_business', (SELECT count(*) FROM profiles WHERE plan = 'business'),
    'total_quotes', (SELECT count(*) FROM quotes),
    'total_invoices', (SELECT count(*) FROM invoices),
    'total_projects', (SELECT count(*) FROM projects),
    'total_clients', (SELECT count(*) FROM clients),
    'total_leads', (SELECT count(*) FROM leads),
    'total_revenue_quotes', (SELECT COALESCE(sum(total_ttc), 0) FROM quotes WHERE status = 'accepte'),
    'total_revenue_invoices', (SELECT COALESCE(sum(total_ttc), 0) FROM invoices WHERE status = 'payee')
  ) INTO result;

  RETURN result;
END;
$$;

-- get_admin_users
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      u.id,
      u.email,
      u.created_at AS signed_up_at,
      u.last_sign_in_at,
      p.full_name,
      p.company_name,
      p.company_activity,
      p.company_city,
      p.team_size,
      p.plan,
      p.plan_started_at,
      p.onboarding_completed,
      COALESCE(p.is_admin, false) AS is_admin,
      (SELECT count(*) FROM quotes) AS quote_count,
      (SELECT count(*) FROM invoices) AS invoice_count,
      (SELECT count(*) FROM projects) AS project_count,
      (SELECT count(*) FROM clients) AS client_count
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    ORDER BY u.created_at DESC
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- get_admin_signups_over_time
CREATE OR REPLACE FUNCTION public.get_admin_signups_over_time(period text DEFAULT 'month')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF period = 'day' THEN
    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
      SELECT date_trunc('hour', created_at)::text AS label, count(*) AS value
      FROM auth.users
      WHERE created_at >= CURRENT_DATE
      GROUP BY 1 ORDER BY 1
    ) t;
  ELSIF period = 'week' THEN
    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
      SELECT to_char(created_at, 'Dy DD') AS label, count(*) AS value
      FROM auth.users
      WHERE created_at >= date_trunc('week', CURRENT_DATE)
      GROUP BY date_trunc('day', created_at), to_char(created_at, 'Dy DD')
      ORDER BY date_trunc('day', created_at)
    ) t;
  ELSIF period = 'year' THEN
    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
      SELECT to_char(created_at, 'Mon') AS label, count(*) AS value
      FROM auth.users
      WHERE created_at >= date_trunc('year', CURRENT_DATE)
      GROUP BY date_trunc('month', created_at), to_char(created_at, 'Mon')
      ORDER BY date_trunc('month', created_at)
    ) t;
  ELSE
    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
      SELECT to_char(created_at, 'DD Mon') AS label, count(*) AS value
      FROM auth.users
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
      GROUP BY date_trunc('day', created_at), to_char(created_at, 'DD Mon')
      ORDER BY date_trunc('day', created_at)
    ) t;
  END IF;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- update_platform_config
CREATE OR REPLACE FUNCTION public.update_platform_config(config_key text, config_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO platform_config (key, value, updated_at)
  VALUES (config_key, config_value, now())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();
END;
$$;

-- get_admin_referral_stats
CREATE OR REPLACE FUNCTION public.get_admin_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF NOT is_admin() THEN
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

-- get_admin_referrals
CREATE OR REPLACE FUNCTION public.get_admin_referrals()
RETURNS TABLE(user_id uuid, email text, full_name text, company_name text, code text, invites_sent bigint, invites_opened bigint, signups bigint, subscribed bigint, months_earned integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF NOT is_admin() THEN
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

NOTIFY pgrst, 'reload schema';
