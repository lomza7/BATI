-- ============================================================
-- Site vitrine artisan : publication chantier + avis + SEO
-- ============================================================

-- ── projects : champs de publication site ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='public_description') THEN
    ALTER TABLE projects ADD COLUMN public_description text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='public_category') THEN
    ALTER TABLE projects ADD COLUMN public_category text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='public_slug') THEN
    ALTER TABLE projects ADD COLUMN public_slug text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='public_completion_date') THEN
    ALTER TABLE projects ADD COLUMN public_completion_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='published_at') THEN
    ALTER TABLE projects ADD COLUMN published_at timestamptz;
  END IF;
END $$;

-- Unicite du slug par user (un artisan ne peut pas avoir deux chantiers publies avec le meme slug)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_public_slug
  ON projects(user_id, public_slug) WHERE public_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_published_public
  ON projects(user_id, published_at DESC) WHERE is_public = true;

-- ── reviews : flag publication + sync externe ────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='is_published_on_site') THEN
    ALTER TABLE reviews ADD COLUMN is_published_on_site boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='external_id') THEN
    ALTER TABLE reviews ADD COLUMN external_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='external_source') THEN
    ALTER TABLE reviews ADD COLUMN external_source text DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='review_date') THEN
    ALTER TABLE reviews ADD COLUMN review_date timestamptz;
  END IF;
END $$;

-- Unicite d'un avis externe par artisan (eviter les doublons lors du sync)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_external
  ON reviews(user_id, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_published_site
  ON reviews(user_id) WHERE is_published_on_site = true;

-- ── RLS anon : ne lire que les avis publies sur le site ──────
DROP POLICY IF EXISTS "anon_reviews_published_site" ON reviews;
CREATE POLICY "anon_reviews_published_site" ON reviews
  FOR SELECT TO anon
  USING (
    is_published_on_site = true
    AND EXISTS (
      SELECT 1 FROM artisan_sites
      WHERE artisan_sites.user_id = reviews.user_id
      AND artisan_sites.status = 'published'
    )
  );
