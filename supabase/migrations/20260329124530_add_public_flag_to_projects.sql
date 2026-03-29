/*
  # Add public visibility flag to projects

  1. Modified Tables
    - `projects`
      - `is_public` (boolean, default false) - Whether the project is visible on the public showcase page

  2. Security
    - Add RLS policy for anonymous users to view public projects (is_public = true)
    - This enables a shareable link where clients can see completed/active projects

  3. Notes
    - Only projects with is_public = true will be visible to anonymous users
    - All other data remains private
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE projects ADD COLUMN is_public boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_is_public ON projects(is_public) WHERE is_public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Anyone can view public projects'
  ) THEN
    CREATE POLICY "Anyone can view public projects"
      ON projects FOR SELECT
      TO anon
      USING (is_public = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'Anyone can view clients of public projects'
  ) THEN
    CREATE POLICY "Anyone can view clients of public projects"
      ON clients FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM projects
          WHERE projects.client_id = clients.id
          AND projects.is_public = true
        )
      );
  END IF;
END $$;
