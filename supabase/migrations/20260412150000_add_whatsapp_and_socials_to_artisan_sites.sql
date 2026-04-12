-- Add WhatsApp phone number and social media links to artisan_sites
ALTER TABLE artisan_sites
  ADD COLUMN IF NOT EXISTS whatsapp_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;

-- social_links structure:
-- {
--   "instagram": "https://instagram.com/...",
--   "tiktok": "https://tiktok.com/@...",
--   "facebook": "https://facebook.com/...",
--   "linkedin": "https://linkedin.com/in/..."
-- }
