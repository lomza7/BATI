-- Tracking des ouvertures de devis
CREATE TABLE IF NOT EXISTS quote_send_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid REFERENCES quote_sends(id) ON DELETE CASCADE NOT NULL,
  viewed_at timestamptz DEFAULT now(),
  user_agent text DEFAULT ''
);

ALTER TABLE quote_send_views ENABLE ROW LEVEL SECURITY;

-- L'artisan peut voir les vues de ses envois
CREATE POLICY "Users can view own send views"
  ON quote_send_views FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quote_sends qs
      WHERE qs.id = quote_send_views.send_id
      AND qs.user_id = auth.uid()
    )
  );

-- Anon peut inserer une vue pour un envoi valide
CREATE POLICY "Anon can log views for valid sends"
  ON quote_send_views FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote_sends qs
      WHERE qs.id = quote_send_views.send_id
      AND qs.expires_at > now()
    )
  );

-- Ajouter un compteur de vues sur quote_sends
ALTER TABLE quote_sends ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quote_send_views_send_id ON quote_send_views(send_id);
