-- Lier les tâches à un client (optionnel)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_todos_client ON todos(client_id);
