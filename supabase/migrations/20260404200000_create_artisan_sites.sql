-- ============================================================
-- Site vitrine artisan — table + RLS
-- ============================================================

CREATE TABLE IF NOT EXISTS artisan_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slug text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'draft',       -- draft | published
  theme text NOT NULL DEFAULT 'modern',       -- modern | warm | clean | bold
  site_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  show_services boolean DEFAULT true,
  show_projects boolean DEFAULT true,
  show_reviews boolean DEFAULT true,
  show_contact boolean DEFAULT true,
  custom_slogan text DEFAULT '',
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE artisan_sites ENABLE ROW LEVEL SECURITY;

-- Proprietaire : CRUD complet
CREATE POLICY "owner_crud" ON artisan_sites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public : lecture des sites publies
CREATE POLICY "public_read" ON artisan_sites
  FOR SELECT TO anon
  USING (status = 'published');

-- Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_artisan_sites_user ON artisan_sites(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artisan_sites_slug ON artisan_sites(slug);
CREATE INDEX IF NOT EXISTS idx_artisan_sites_status ON artisan_sites(status) WHERE status = 'published';

-- ============================================================
-- RLS anon pour les donnees liees au site public
-- ============================================================

-- Profils : anon peut lire le profil d'un artisan qui a un site publie
CREATE POLICY "anon_profiles_published_site" ON profiles
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM artisan_sites
      WHERE artisan_sites.user_id = profiles.id
      AND artisan_sites.status = 'published'
    )
  );

-- Avis : anon peut lire les avis d'un artisan qui a un site publie
CREATE POLICY "anon_reviews_published_site" ON reviews
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM artisan_sites
      WHERE artisan_sites.user_id = reviews.user_id
      AND artisan_sites.status = 'published'
    )
  );

-- Photos projet : anon peut lire les photos des projets publics
CREATE POLICY "anon_project_photos_public" ON project_photos
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_photos.project_id
      AND projects.is_public = true
    )
  );

-- Projets publics : anon peut lire les projets publics d'un artisan avec site publie
CREATE POLICY "anon_projects_published_site" ON projects
  FOR SELECT TO anon
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM artisan_sites
      WHERE artisan_sites.user_id = projects.user_id
      AND artisan_sites.status = 'published'
    )
  );

-- Services : anon peut lire les services d'un artisan avec site publie
CREATE POLICY "anon_services_published_site" ON services
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM artisan_sites
      WHERE artisan_sites.user_id = services.user_id
      AND artisan_sites.status = 'published'
    )
  );
