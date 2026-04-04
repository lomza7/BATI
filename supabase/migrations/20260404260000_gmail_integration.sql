-- Gmail integration

CREATE TABLE IF NOT EXISTS gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email_address text NOT NULL DEFAULT '',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_crud" ON gmail_connections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_gmail_connections_user ON gmail_connections(user_id);
