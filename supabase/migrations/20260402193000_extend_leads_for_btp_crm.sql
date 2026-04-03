ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_name text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_address text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_postal_code text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_city text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_lat numeric;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_lng numeric;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS work_type text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS work_details text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_kind text DEFAULT 'travaux';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'normal';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_date date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_visit_date date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_next_action_date ON leads(next_action_date);
CREATE INDEX IF NOT EXISTS idx_leads_work_type ON leads(work_type);
