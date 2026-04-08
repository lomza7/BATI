-- Platform secrets: admin-only key-value store for sensitive API keys
-- (image generation providers, etc.). NEVER exposed via public RPC.

CREATE TABLE IF NOT EXISTS platform_secrets (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  label text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_secrets ENABLE ROW LEVEL SECURITY;

-- Only admin can read or write secrets directly via RLS.
-- (Server-side routes use the service role and bypass RLS.)
CREATE POLICY "Admin can read secrets"
  ON platform_secrets FOR SELECT TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'louis@maaza.pro'
  );

CREATE POLICY "Admin can manage secrets"
  ON platform_secrets FOR ALL TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'louis@maaza.pro'
  )
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'louis@maaza.pro'
  );

-- Seed default keys for image generation providers
INSERT INTO platform_secrets (key, value, label) VALUES
  ('image_provider', 'openai', 'Provider d''image actif (openai | gemini)'),
  ('openai_api_key', '', 'OpenAI API Key (gpt-image-1)'),
  ('openai_image_model', 'gpt-image-1', 'OpenAI image model'),
  ('gemini_api_key', '', 'Google Gemini API Key'),
  ('gemini_image_model', 'gemini-2.5-flash-image', 'Gemini image model')
ON CONFLICT (key) DO NOTHING;
