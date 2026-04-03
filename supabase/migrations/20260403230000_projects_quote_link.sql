-- Lien entre un chantier et le devis d'origine
ALTER TABLE projects ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_quote_id_idx ON projects (quote_id);
