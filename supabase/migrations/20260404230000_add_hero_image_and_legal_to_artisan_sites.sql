ALTER TABLE artisan_sites ADD COLUMN IF NOT EXISTS hero_image_url text DEFAULT '';
ALTER TABLE artisan_sites ADD COLUMN IF NOT EXISTS legal_text text DEFAULT '';

-- Storage bucket for site assets (logo, hero image)
INSERT INTO storage.buckets (id, name, public) VALUES ('site-assets', 'site-assets', true) ON CONFLICT (id) DO NOTHING;
