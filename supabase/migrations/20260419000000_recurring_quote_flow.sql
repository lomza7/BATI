-- ============================================================
-- Devis recurrent → contrat recurrent → factures auto
-- ============================================================

-- 1. Colonnes sur quotes pour marquer un devis comme recurrent
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recurring_frequency text DEFAULT 'mensuel';

-- 2. Colonne line_items sur recurring_contracts pour factures multi-lignes
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]';

-- 3. Corriger le RPC sign_quote_docuseal pour activer les contrats lies
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

  -- Activer les contrats recurrents lies au devis
  UPDATE recurring_contracts
  SET status = 'actif',
      updated_at = now()
  WHERE quote_id = v_send.quote_id
    AND status = 'en_attente';

  -- Passer le lead lie en gagne
  UPDATE leads
  SET stage = 'gagne',
      updated_at = now()
  WHERE quote_id = v_send.quote_id;

  RETURN json_build_object('success', true);
END;
$$;
