-- Lien direct facture → chantier (pour les factures créées sans devis)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS invoices_project_id_idx ON invoices (project_id);
