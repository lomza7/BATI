-- ============================================================
-- Systeme de signature electronique des devis
-- ============================================================

-- Table quote_sends : envois de devis pour signature (magic link)
CREATE TABLE IF NOT EXISTS quote_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL DEFAULT '',
  client_email text DEFAULT '',
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  viewed_at timestamptz,
  signed_at timestamptz,
  signature_url text DEFAULT '',
  signer_user_agent text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quote_sends ENABLE ROW LEVEL SECURITY;

-- Policies authentifiees (artisan proprietaire)
CREATE POLICY "Users can view own quote sends"
  ON quote_sends FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quote sends"
  ON quote_sends FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quote sends"
  ON quote_sends FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quote sends"
  ON quote_sends FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Acces public en lecture via token (pour le magic link)
CREATE POLICY "Public can view quote sends by token"
  ON quote_sends FOR SELECT TO anon
  USING (
    token IS NOT NULL
    AND expires_at > now()
  );

-- Acces public aux devis via envoi valide
CREATE POLICY "Public can view quotes via valid send"
  ON quotes FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM quote_sends qs
      WHERE qs.quote_id = quotes.id
      AND qs.expires_at > now()
    )
  );

-- Acces public aux lignes de devis via envoi valide
CREATE POLICY "Public can view quote_lines via valid send"
  ON quote_lines FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM quote_sends qs
      JOIN quotes q ON q.id = qs.quote_id
      WHERE q.id = quote_lines.quote_id
      AND qs.expires_at > now()
    )
  );

-- Acces public au nom du client via envoi valide
CREATE POLICY "Public can view clients via valid quote send"
  ON clients FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN quote_sends qs ON qs.quote_id = q.id
      WHERE q.client_id = clients.id
      AND qs.expires_at > now()
    )
  );

-- Acces public au profil artisan via envoi valide
CREATE POLICY "Public can view profiles via valid quote send"
  ON profiles FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM quote_sends qs
      WHERE qs.user_id = profiles.id
      AND qs.expires_at > now()
    )
  );

-- Fonction RPC pour signer un devis (SECURITY DEFINER = bypass RLS)
CREATE OR REPLACE FUNCTION public.sign_quote(
  p_token text,
  p_signature_url text,
  p_signer_user_agent text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_send quote_sends%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  -- Verrouillage et validation atomique
  SELECT * INTO v_send
  FROM quote_sends
  WHERE token = p_token
    AND expires_at > v_now
    AND signed_at IS NULL
  FOR UPDATE;

  IF v_send IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Lien invalide, expire ou deja signe');
  END IF;

  -- Mise a jour du send
  UPDATE quote_sends
  SET signed_at = v_now,
      signature_url = p_signature_url,
      signer_user_agent = p_signer_user_agent
  WHERE id = v_send.id;

  -- Mise a jour du devis
  UPDATE quotes
  SET status = 'accepte',
      signed_at = v_now,
      updated_at = v_now
  WHERE id = v_send.quote_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Bucket storage pour les signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Anon peut uploader des signatures
CREATE POLICY "Anon can upload signatures"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'signatures');

-- Tout le monde peut voir les signatures
CREATE POLICY "Public can view signatures"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'signatures');

-- Authentifie peut aussi uploader des signatures
CREATE POLICY "Authenticated can upload signatures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures');

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_quote_sends_token ON quote_sends(token);
CREATE INDEX IF NOT EXISTS idx_quote_sends_user_id ON quote_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_sends_quote_id ON quote_sends(quote_id);
