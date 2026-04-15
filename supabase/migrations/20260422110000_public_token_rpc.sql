-- Phase 2.A — RPC SECURITY DEFINER pour accès public par magic link.
-- Remplace les queries anon directes dans /d /f /c. Chaque fonction:
--   1. Résout le token vers un send row (ou NULL si invalide/expiré).
--   2. Retourne UNIQUEMENT les données du scope de ce send (jamais de listing).
--   3. Bump viewed_at au passage.
-- Exécuté avec les droits du propriétaire → bypasse RLS → c'est voulu, la
-- validation du token remplace RLS. Ne JAMAIS retourner de colonnes
-- sensibles (ex: user.email du profil).

-- ─────────────────────────────────────────────────────────────
-- 1. DEVIS PUBLIC
-- ─────────────────────────────────────────────────────────────
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
  LIMIT 1;

  IF v_send.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Bump viewed_at (first view only, ignore update race).
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

REVOKE ALL ON FUNCTION public.get_public_quote_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_quote_by_token(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. FACTURE PUBLIQUE
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_invoice_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_send record;
  v_invoice jsonb;
  v_lines jsonb;
  v_artisan jsonb;
  v_bank jsonb;
  v_linked_quote_number text;
  v_linked_deposits jsonb := '[]'::jsonb;
  v_stripe_enabled boolean := false;
BEGIN
  SELECT * INTO v_send
  FROM invoice_sends
  WHERE token = p_token
    AND expires_at > now()
  LIMIT 1;

  IF v_send.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE invoice_sends
  SET viewed_at = now()
  WHERE id = v_send.id AND viewed_at IS NULL;

  SELECT to_jsonb(i) - 'user_id' || jsonb_build_object(
    'clients', (
      SELECT to_jsonb(c) - 'user_id' - 'notes' - 'source' - 'contact_type' - 'created_at' - 'updated_at' - 'deleted_at'
      FROM clients c
      WHERE c.id = i.client_id
    )
  )
  INTO v_invoice
  FROM invoices i
  WHERE i.id = v_send.invoice_id;

  IF v_invoice IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.position), '[]'::jsonb)
  INTO v_lines
  FROM invoice_lines l
  WHERE l.invoice_id = v_send.invoice_id;

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

  IF (v_invoice->>'bank_account_id') IS NOT NULL THEN
    SELECT to_jsonb(b)
    INTO v_bank
    FROM (
      SELECT label, bank_name, account_holder, iban, bic
      FROM bank_accounts
      WHERE id = (v_invoice->>'bank_account_id')::uuid
        AND user_id = v_send.user_id
        AND deleted_at IS NULL
    ) b;
  END IF;

  -- Devis source (pour factures d'acompte/solde)
  IF (v_invoice->>'quote_id') IS NOT NULL THEN
    SELECT quote_number INTO v_linked_quote_number
    FROM quotes
    WHERE id = (v_invoice->>'quote_id')::uuid;

    -- Acomptes liés (pour factures de solde)
    IF (v_invoice->>'invoice_type') = 'solde' THEN
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'invoice_number', d.invoice_number,
          'total_ttc', d.total_ttc,
          'issued_at', d.issued_at,
          'created_at', d.created_at,
          'status', d.status,
          'deposit_percentage', d.deposit_percentage
        ) ORDER BY d.issued_at NULLS LAST, d.created_at
      ), '[]'::jsonb)
      INTO v_linked_deposits
      FROM invoices d
      WHERE d.quote_id = (v_invoice->>'quote_id')::uuid
        AND d.invoice_type = 'acompte'
        AND d.status <> 'annulee';
    END IF;
  END IF;

  -- Stripe payment status
  SELECT charges_enabled INTO v_stripe_enabled
  FROM stripe_connections
  WHERE user_id = v_send.user_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'send', jsonb_build_object(
      'id', v_send.id,
      'invoice_id', v_send.invoice_id,
      'client_name', v_send.client_name,
      'expires_at', v_send.expires_at,
      'viewed_at', v_send.viewed_at,
      'paid_at', v_send.paid_at,
      'enable_stripe_payment', v_send.enable_stripe_payment
    ),
    'invoice', v_invoice,
    'lines', v_lines,
    'artisan', v_artisan,
    'bank_account', v_bank,
    'linked_quote_number', v_linked_quote_number,
    'linked_deposits', v_linked_deposits,
    'stripe_charges_enabled', coalesce(v_stripe_enabled, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_by_token(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. CATALOGUE PUBLIC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_catalog_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_send record;
  v_catalog jsonb;
  v_collections jsonb := '[]'::jsonb;
  v_existing jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_send
  FROM catalog_sends
  WHERE token = p_token
    AND expires_at > now()
  LIMIT 1;

  IF v_send.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE catalog_sends
  SET viewed_at = now()
  WHERE id = v_send.id AND viewed_at IS NULL;

  SELECT jsonb_build_object('name', name, 'description', description)
  INTO v_catalog
  FROM catalogs
  WHERE id = v_send.catalog_id
    AND deleted_at IS NULL;

  IF v_catalog IS NULL THEN
    RETURN NULL;
  END IF;

  -- Collections ordonnées + produits
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', col.id,
      'name', col.name,
      'color', col.color,
      'products', (
        SELECT coalesce(jsonb_agg(to_jsonb(pr) ORDER BY pr.sort_order), '[]'::jsonb)
        FROM catalog_products pr
        WHERE pr.collection_id = col.id
      )
    ) ORDER BY link.sort_order
  ), '[]'::jsonb)
  INTO v_collections
  FROM catalog_catalog_collections link
  JOIN catalog_collections col ON col.id = link.collection_id
  WHERE link.catalog_id = v_send.catalog_id;

  -- Sélections existantes
  SELECT coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'note', note)), '[]'::jsonb)
  INTO v_existing
  FROM catalog_client_selections
  WHERE send_id = v_send.id;

  RETURN jsonb_build_object(
    'send', jsonb_build_object(
      'id', v_send.id,
      'catalog_id', v_send.catalog_id,
      'client_name', v_send.client_name,
      'expires_at', v_send.expires_at
    ),
    'catalog', v_catalog,
    'collections', v_collections,
    'existing_selections', v_existing
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_catalog_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_catalog_by_token(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. ENREGISTREMENT SÉLECTIONS CATALOGUE
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_catalog_selection(p_token text, p_selections jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_send record;
  v_item jsonb;
  v_product_id uuid;
  v_allowed boolean;
BEGIN
  SELECT * INTO v_send
  FROM catalog_sends
  WHERE token = p_token
    AND expires_at > now()
  LIMIT 1;

  IF v_send.id IS NULL THEN
    RETURN false;
  END IF;

  -- Si déjà des sélections, refuser (immuable côté client).
  IF EXISTS (SELECT 1 FROM catalog_client_selections WHERE send_id = v_send.id) THEN
    RETURN false;
  END IF;

  -- Insère chaque sélection après avoir vérifié que le produit appartient
  -- bien au catalogue attaché à ce token.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_selections)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;

    SELECT EXISTS (
      SELECT 1
      FROM catalog_products pr
      JOIN catalog_catalog_collections link ON link.collection_id = pr.collection_id
      WHERE pr.id = v_product_id
        AND link.catalog_id = v_send.catalog_id
    ) INTO v_allowed;

    IF v_allowed THEN
      INSERT INTO catalog_client_selections (send_id, product_id, note)
      VALUES (v_send.id, v_product_id, coalesce(v_item->>'note', ''));
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_catalog_selection(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_catalog_selection(text, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
