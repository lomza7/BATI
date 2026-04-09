-- Insurance information for artisans, mandatory on quotes and invoices
-- (assurance professionnelle / décennale / biennale).
--
-- Stored as plain columns rather than JSONB so they can be queried and
-- displayed easily on the public quote/invoice views.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS insurance_company text,
  ADD COLUMN IF NOT EXISTS insurance_address text,
  ADD COLUMN IF NOT EXISTS insurance_coverage_zone text,
  ADD COLUMN IF NOT EXISTS insurance_contract_number text,
  ADD COLUMN IF NOT EXISTS insurance_warranty_type text;

COMMENT ON COLUMN profiles.insurance_company IS 'Nom de la compagnie d''assurance professionnelle';
COMMENT ON COLUMN profiles.insurance_address IS 'Adresse du siège de l''assureur';
COMMENT ON COLUMN profiles.insurance_coverage_zone IS 'Zone de couverture : France, Europe, International';
COMMENT ON COLUMN profiles.insurance_contract_number IS 'Numéro de contrat / police d''assurance';
COMMENT ON COLUMN profiles.insurance_warranty_type IS 'Type de garantie : décennale, biennale, RC Pro, etc.';
