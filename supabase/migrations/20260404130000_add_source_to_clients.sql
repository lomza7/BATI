ALTER TABLE clients ADD COLUMN IF NOT EXISTS source text DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_clients_source ON clients(source);
