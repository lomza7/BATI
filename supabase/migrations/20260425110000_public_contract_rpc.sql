-- ============================================================
-- RPC public pour afficher un contrat recurrent via magic link.
-- Meme pattern que get_public_quote_by_token mais renvoie la
-- structure contrat (avec operations incluses/exclues, categorie, etc.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_contract_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_send record;
  v_contract jsonb;
  v_artisan jsonb;
BEGIN
  SELECT * INTO v_send
  FROM quote_sends
  WHERE token = p_token
    AND expires_at > now()
    AND document_kind = 'contract'
    AND recurring_contract_id IS NOT NULL
  LIMIT 1;

  IF v_send.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE quote_sends
  SET viewed_at = now()
  WHERE id = v_send.id AND viewed_at IS NULL;

  SELECT to_jsonb(rc) - 'user_id' || jsonb_build_object(
    'clients', (
      SELECT to_jsonb(c) - 'user_id' - 'notes' - 'source' - 'contact_type' - 'created_at' - 'updated_at' - 'deleted_at'
      FROM clients c
      WHERE c.id = rc.client_id
    )
  )
  INTO v_contract
  FROM recurring_contracts rc
  WHERE rc.id = v_send.recurring_contract_id;

  IF v_contract IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(p) - 'email' - 'phone'
  INTO v_artisan
  FROM (
    SELECT company_name, full_name, siret, tva_number, company_address,
           company_postal_code, company_city, company_phone, logo_url,
           insurance_company, insurance_address, insurance_coverage_zone,
           insurance_contract_number, insurance_warranty_type, document_config
    FROM profiles
    WHERE id = v_send.user_id
  ) p;

  RETURN jsonb_build_object(
    'kind', 'contract',
    'send', jsonb_build_object(
      'id', v_send.id,
      'recurring_contract_id', v_send.recurring_contract_id,
      'client_name', v_send.client_name,
      'expires_at', v_send.expires_at,
      'viewed_at', v_send.viewed_at,
      'signed_at', v_send.signed_at,
      'docuseal_slug', v_send.docuseal_slug,
      'docuseal_submission_id', v_send.docuseal_submission_id,
      'docuseal_certificate_url', v_send.docuseal_certificate_url,
      'docuseal_audit_log_url', v_send.docuseal_audit_log_url,
      'docuseal_signed_document_url', v_send.docuseal_signed_document_url
    ),
    'contract', v_contract,
    'artisan', v_artisan
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_contract_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_contract_by_token(text) TO anon, authenticated;

-- Patch: get_public_quote_by_token doit ignorer les sends de type contract
-- (sinon il essaierait de joindre quotes avec un quote_id NULL).
CREATE OR REPLACE FUNCTION public.get_public_quote_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_send record;
  v_quote jsonb;
  v_lines jsonb;
  v_artisan jsonb;
  v_bank jsonb;
BEGIN
  SELECT * INTO v_send
  FROM quote_sends
  WHERE token = p_token
    AND expires_at > now()
    AND coalesce(document_kind, 'quote') = 'quote'
    AND quote_id IS NOT NULL
  LIMIT 1;

  IF v_send.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE quote_sends
  SET viewed_at = now()
  WHERE id = v_send.id AND viewed_at IS NULL;

  SELECT to_jsonb(q) - 'user_id' || jsonb_build_object(
    'clients', (
      SELECT to_jsonb(c) - 'user_id' - 'notes' - 'source' - 'contact_type' - 'created_at' - 'updated_at' - 'deleted_at'
      FROM clients c
      WHERE c.id = q.client_id
    )
  )
  INTO v_quote
  FROM quotes q
  WHERE q.id = v_send.quote_id
    AND q.deleted_at IS NULL;

  IF v_quote IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.position), '[]'::jsonb)
  INTO v_lines
  FROM quote_lines l
  WHERE l.quote_id = v_send.quote_id;

  SELECT to_jsonb(p) - 'email' - 'phone'
  INTO v_artisan
  FROM (
    SELECT company_name, full_name, siret, tva_number, company_address,
           company_postal_code, company_city, company_phone, logo_url,
           insurance_company, insurance_address, insurance_coverage_zone,
           insurance_contract_number, insurance_warranty_type, document_config
    FROM profiles
    WHERE id = v_send.user_id
  ) p;

  IF (v_quote->>'bank_account_id') IS NOT NULL THEN
    SELECT to_jsonb(b)
    INTO v_bank
    FROM (
      SELECT label, bank_name, account_holder, iban, bic
      FROM bank_accounts
      WHERE id = (v_quote->>'bank_account_id')::uuid
        AND user_id = v_send.user_id
        AND deleted_at IS NULL
    ) b;
  END IF;

  RETURN jsonb_build_object(
    'kind', 'quote',
    'send', jsonb_build_object(
      'id', v_send.id,
      'quote_id', v_send.quote_id,
      'client_name', v_send.client_name,
      'expires_at', v_send.expires_at,
      'viewed_at', v_send.viewed_at,
      'signed_at', v_send.signed_at,
      'signature_url', v_send.signature_url,
      'docuseal_slug', v_send.docuseal_slug,
      'docuseal_submission_id', v_send.docuseal_submission_id,
      'docuseal_certificate_url', v_send.docuseal_certificate_url,
      'docuseal_audit_log_url', v_send.docuseal_audit_log_url,
      'docuseal_signed_document_url', v_send.docuseal_signed_document_url
    ),
    'quote', v_quote,
    'lines', v_lines,
    'artisan', v_artisan,
    'bank_account', v_bank
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
