-- Lien entre un devis et son chantier (plusieurs devis possibles par chantier)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS quotes_project_id_idx ON quotes (project_id);
