-- Add contact_type to clients for filtering (client, prospect, prestataire)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='contact_type') THEN
    ALTER TABLE clients ADD COLUMN contact_type text NOT NULL DEFAULT 'client';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_contact_type ON clients(contact_type);
