-- ============================================================
-- Integration DocuSeal pour signature electronique avancee
-- ============================================================

-- Colonnes DocuSeal sur quote_sends
ALTER TABLE quote_sends ADD COLUMN IF NOT EXISTS docuseal_submission_id integer;
ALTER TABLE quote_sends ADD COLUMN IF NOT EXISTS docuseal_slug text;
ALTER TABLE quote_sends ADD COLUMN IF NOT EXISTS docuseal_audit_log_url text DEFAULT '';
ALTER TABLE quote_sends ADD COLUMN IF NOT EXISTS docuseal_signed_document_url text DEFAULT '';
ALTER TABLE quote_sends ADD COLUMN IF NOT EXISTS docuseal_certificate_url text DEFAULT '';
ALTER TABLE quote_sends ADD COLUMN IF NOT EXISTS signer_ip text DEFAULT '';

-- Index pour les lookups webhook
CREATE INDEX IF NOT EXISTS idx_quote_sends_docuseal_sub ON quote_sends(docuseal_submission_id);

-- RPC pour signer via DocuSeal (appelee par le webhook)
CREATE OR REPLACE FUNCTION sign_quote_docuseal(
  p_docuseal_submission_id integer,
  p_docuseal_submitter_id integer DEFAULT NULL,
  p_audit_log_url text DEFAULT '',
  p_signed_document_url text DEFAULT '',
  p_certificate_url text DEFAULT '',
  p_signer_ip text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_send record;
BEGIN
  -- Trouver le send par submission DocuSeal
  SELECT * INTO v_send
  FROM quote_sends
  WHERE docuseal_submission_id = p_docuseal_submission_id
  FOR UPDATE;

  IF v_send IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Submission DocuSeal introuvable');
  END IF;

  -- Deja signe = idempotent
  IF v_send.signed_at IS NOT NULL THEN
    RETURN json_build_object('success', true, 'already_signed', true);
  END IF;

  -- Mettre a jour le send avec les donnees DocuSeal
  UPDATE quote_sends
  SET signed_at = now(),
      docuseal_audit_log_url = p_audit_log_url,
      docuseal_signed_document_url = p_signed_document_url,
      docuseal_certificate_url = p_certificate_url,
      signer_ip = p_signer_ip
  WHERE id = v_send.id;

  -- Passer le devis en accepte
  UPDATE quotes
  SET status = 'accepte',
      signed_at = now(),
      updated_at = now()
  WHERE id = v_send.quote_id;

  -- Passer le lead lie en gagne
  UPDATE leads
  SET stage = 'gagne',
      updated_at = now()
  WHERE quote_id = v_send.quote_id;

  RETURN json_build_object('success', true);
END;
$$;
