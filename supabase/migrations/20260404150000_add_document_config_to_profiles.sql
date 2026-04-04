-- Document template configuration for quotes and invoices
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS document_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';

-- Storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Users can update logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "Anyone can view logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'logos');

CREATE POLICY "Users can delete logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos');
