-- Google Calendar integration

-- 1. Tokens storage
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at bigint NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_token text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_crud" ON google_calendar_connections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_google_calendar_connections_user ON google_calendar_connections(user_id);

-- 2. Personal calendar events (separate from team planning_events)
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'autre',
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time,
  end_time time,
  color text DEFAULT '#3b82f6',
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  source text DEFAULT 'hellobat',           -- 'hellobat' | 'google_calendar'
  google_event_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own calendar_events" ON calendar_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar_events" ON calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar_events" ON calendar_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar_events" ON calendar_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_dates ON calendar_events(start_date, end_date);
CREATE INDEX idx_calendar_events_google_id ON calendar_events(google_event_id) WHERE google_event_id IS NOT NULL;
