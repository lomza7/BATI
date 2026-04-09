-- ============================================================
-- Site vitrine artisan — choix du layout du hero
-- ============================================================
-- Permet a l'artisan de choisir entre :
--   - single   : 1 photo en fond (comportement historique)
--   - grid     : 3 photos en grille a cote du texte
--   - carousel : 3 photos qui defilent automatiquement en fond
--
-- hero_images stocke les URLs (max 3) utilisees pour les modes grid/carousel.
-- Le champ historique hero_image_url reste pour la compatibilite et contient
-- la premiere image quand le mode est "single" ou en fallback.

ALTER TABLE public.artisan_sites
  ADD COLUMN IF NOT EXISTS hero_layout text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS hero_images text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.artisan_sites
  DROP CONSTRAINT IF EXISTS artisan_sites_hero_layout_check;

ALTER TABLE public.artisan_sites
  ADD CONSTRAINT artisan_sites_hero_layout_check
  CHECK (hero_layout IN ('single', 'grid', 'carousel'));
