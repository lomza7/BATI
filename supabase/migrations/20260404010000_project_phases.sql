-- Suivi des phases d'avancement du chantier
-- Format: [{"key": "preparation", "completed_at": "2026-04-01T10:00:00Z"}, ...]
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_phases jsonb NOT NULL DEFAULT '[]';
