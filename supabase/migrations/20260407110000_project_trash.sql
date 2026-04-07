-- Soft-delete support for projects with a 30-day trash window

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_user_deleted_at ON projects(user_id, deleted_at);
