-- Add quote_id column to leads table to link opportunities to quotes
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_quote_id ON leads(quote_id);

-- Update sign_quote RPC to also move the linked lead to 'gagne' stage
CREATE OR REPLACE FUNCTION sign_quote(p_token text, p_signature_url text, p_signer_user_agent text DEFAULT '')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_send record;
BEGIN
  -- Lock the send row
  SELECT * INTO v_send
  FROM quote_sends
  WHERE token = p_token
  FOR UPDATE;

  IF v_send IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Token invalide');
  END IF;

  IF v_send.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Ce lien a expire');
  END IF;

  IF v_send.signed_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ce devis a deja ete signe');
  END IF;

  -- Update the send record
  UPDATE quote_sends
  SET signed_at = now(),
      signature_url = p_signature_url,
      signer_user_agent = p_signer_user_agent
  WHERE id = v_send.id;

  -- Update the quote status
  UPDATE quotes
  SET status = 'accepte',
      signed_at = now(),
      updated_at = now()
  WHERE id = v_send.quote_id;

  -- Move linked lead to 'gagne' stage
  UPDATE leads
  SET stage = 'gagne',
      updated_at = now()
  WHERE quote_id = v_send.quote_id;

  RETURN json_build_object('success', true);
END;
$$;
