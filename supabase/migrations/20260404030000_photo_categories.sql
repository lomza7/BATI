-- Catégories de photos chantier : presentation, avant, pendant, apres
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'avant';
CREATE INDEX IF NOT EXISTS idx_project_photos_category ON project_photos(project_id, category);
