-- Conformité comptable française : horodatage + archivage (sans suppression)
-- Art. L. 102 B LPF — conservation 6 ans, intégrité, non-suppression

-- 1. Date/heure d'émission officielle (settée quand status → 'envoyee')
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_at timestamptz;

-- 2. Archivage à la place de la suppression
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- 3. Supprimer la politique de suppression (factures non supprimables)
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON invoices;

-- 4. Index pour les filtres courants
CREATE INDEX IF NOT EXISTS invoices_is_archived_idx ON invoices (is_archived);
CREATE INDEX IF NOT EXISTS invoices_issued_at_idx ON invoices (issued_at);
