-- Admin dashboard: add plan tracking to profiles + admin helper functions

-- 1. Add plan & stripe fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='plan') THEN
    ALTER TABLE profiles ADD COLUMN plan text NOT NULL DEFAULT 'starter';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='stripe_customer_id') THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='plan_started_at') THEN
    ALTER TABLE profiles ADD COLUMN plan_started_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='plan_expires_at') THEN
    ALTER TABLE profiles ADD COLUMN plan_expires_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);

-- 2. Admin function: get platform stats (SECURITY DEFINER to access auth.users)
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow admin email
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'louis@maaza.pro' THEN
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

-- 3. Admin function: get all users with details
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'louis@maaza.pro' THEN
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

-- 4. Admin function: get signups over time (for charts)
CREATE OR REPLACE FUNCTION get_admin_signups_over_time(period text DEFAULT 'month')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'louis@maaza.pro' THEN
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
