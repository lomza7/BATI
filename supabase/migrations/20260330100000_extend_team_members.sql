/*
  # Extend team_members for full team & subcontractor management

  1. New columns on team_members:
    - type: 'salarie' | 'sous_traitant' | 'interimaire'
    - status: 'actif' | 'inactif'
    - specialty: text (e.g. plomberie, electricite, maconnerie)
    - hourly_rate: numeric (taux horaire)
    - monthly_salary: numeric (salaire mensuel brut, for salaries)
    - weekly_hours: numeric (heures hebdomadaires contractuelles)
    - start_date: date (date d'embauche / debut collaboration)
    - end_date: date (nullable, fin de contrat)
    - company_name: text (for sous_traitants)
    - siret: text (for sous_traitants)
    - address: text
    - city: text
    - postal_code: text
    - avatar_url: text

  2. New table: team_notes
    - Notes/comments on team members for follow-up

  3. New table: team_assignments
    - Track hours worked per team member per project
*/

-- Extend team_members
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='type') THEN
    ALTER TABLE team_members ADD COLUMN type text NOT NULL DEFAULT 'salarie';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='status') THEN
    ALTER TABLE team_members ADD COLUMN status text NOT NULL DEFAULT 'actif';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='specialty') THEN
    ALTER TABLE team_members ADD COLUMN specialty text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='hourly_rate') THEN
    ALTER TABLE team_members ADD COLUMN hourly_rate numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='monthly_salary') THEN
    ALTER TABLE team_members ADD COLUMN monthly_salary numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='weekly_hours') THEN
    ALTER TABLE team_members ADD COLUMN weekly_hours numeric DEFAULT 35;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='start_date') THEN
    ALTER TABLE team_members ADD COLUMN start_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='end_date') THEN
    ALTER TABLE team_members ADD COLUMN end_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='company_name') THEN
    ALTER TABLE team_members ADD COLUMN company_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='siret') THEN
    ALTER TABLE team_members ADD COLUMN siret text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='address') THEN
    ALTER TABLE team_members ADD COLUMN address text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='city') THEN
    ALTER TABLE team_members ADD COLUMN city text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='postal_code') THEN
    ALTER TABLE team_members ADD COLUMN postal_code text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='avatar_url') THEN
    ALTER TABLE team_members ADD COLUMN avatar_url text DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_team_members_type ON team_members(type);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- Team notes table
CREATE TABLE IF NOT EXISTS team_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_notes' AND policyname='Auth users can manage team notes') THEN
    CREATE POLICY "Auth users can manage team notes" ON team_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Team assignments (hours per member per project)
CREATE TABLE IF NOT EXISTS team_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_assignments' AND policyname='Auth users can manage team assignments') THEN
    CREATE POLICY "Auth users can manage team assignments" ON team_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_team_assignments_member ON team_assignments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_project ON team_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_date ON team_assignments(date);
