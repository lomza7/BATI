-- Platform config: key-value store for admin-configurable settings (Stripe price IDs, etc.)

CREATE TABLE IF NOT EXISTS platform_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  label text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read config (needed for pricing display)
CREATE POLICY "Authenticated can read config"
  ON platform_config FOR SELECT TO authenticated
  USING (true);

-- Only admin can write (enforced via RPC, but belt-and-suspenders)
CREATE POLICY "Admin can manage config"
  ON platform_config FOR ALL TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'louis@maaza.pro'
  )
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'louis@maaza.pro'
  );

-- Seed default values
INSERT INTO platform_config (key, value, label) VALUES
  ('stripe_price_starter', '', 'Stripe Price ID — Starter'),
  ('stripe_price_pro', '', 'Stripe Price ID — Pro'),
  ('stripe_price_business', '', 'Stripe Price ID — Business'),
  ('price_starter', '0', 'Prix Starter (EUR/mois)'),
  ('price_pro', '49', 'Prix Pro (EUR/mois)'),
  ('price_business', '89', 'Prix Business (EUR/mois)')
ON CONFLICT (key) DO NOTHING;

-- Admin function to update config
CREATE OR REPLACE FUNCTION update_platform_config(config_key text, config_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'louis@maaza.pro' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE platform_config SET value = config_value, updated_at = now() WHERE key = config_key;
END;
$$;

-- Public function to get all config (for pricing display)
CREATE OR REPLACE FUNCTION get_platform_config()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_object_agg(key, value) INTO result FROM platform_config;
  RETURN COALESCE(result, '{}'::json);
END;
$$;
