-- Soft-delete support for core business entities kept in trash for 30 days

ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE todos
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE services
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE catalogs
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_user_deleted_at ON quotes(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_todos_user_deleted_at ON todos(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_clients_user_deleted_at ON clients(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_services_user_deleted_at ON services(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_catalogs_user_deleted_at ON catalogs(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_leads_user_deleted_at ON leads(user_id, deleted_at);
