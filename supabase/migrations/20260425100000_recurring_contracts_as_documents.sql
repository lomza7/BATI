-- ============================================================
-- Phase B — Contrats recurrents en tant que vrais documents
-- commerciaux (comparable a un devis, signables via DocuSeal)
-- ============================================================

-- 1. Enrichir recurring_contracts avec toutes les colonnes
--    necessaires au template de contrat BTP complet.

-- Identite du document
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS contract_number text;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS category_key text DEFAULT 'autre';
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Lien devis (deja existant via quote_id dans 20260419000000 ? verifions)
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;

-- Type de client et canal
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS client_type text DEFAULT 'b2c'; -- 'b2b' | 'b2c'
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS contract_channel text DEFAULT 'sur_site'; -- 'sur_site' | 'a_distance' | 'hors_etablissement'

-- Site d'intervention
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS site_address text DEFAULT '';
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS site_access_notes text DEFAULT '';

-- Duree & reconduction
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS duration_mode text DEFAULT 'determinee'; -- 'determinee' | 'indeterminee'
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS initial_term_months integer DEFAULT 12;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS renewal_term_months integer DEFAULT 12;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS auto_renewal boolean DEFAULT true;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS notice_period_months integer DEFAULT 2;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS end_date date;

-- Paiement
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'virement'; -- 'virement' | 'sepa' | 'cb' | 'cheque' | 'especes'
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS payment_timing text DEFAULT 'terme_echu'; -- 'terme_a_echoir' | 'terme_echu'
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT 30;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS late_penalty_rate numeric DEFAULT 10.0; -- % taux penalite
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS recovery_fee numeric DEFAULT 40.0;

-- Resolution / sanctions
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS breach_cure_period_days integer DEFAULT 30;

-- Contenu libre (includes/excludes/conditions)
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS included_operations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS excluded_operations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS visits_per_year integer DEFAULT 1;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS weather_dependent boolean DEFAULT false;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS intervention_hours text DEFAULT 'Du lundi au vendredi, 8h-18h';
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS emergency_phone text DEFAULT '';
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS response_time text DEFAULT '48h ouvrees';

-- Donnees libres (extension future sans migration)
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}'::jsonb;

-- Signature DocuSeal
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS docuseal_submission_id integer;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS docuseal_submitter_id integer;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS docuseal_audit_log_url text DEFAULT '';
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS docuseal_signed_document_url text DEFAULT '';
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS docuseal_certificate_url text DEFAULT '';
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS signer_ip text DEFAULT '';

-- Proprietaire pour RLS / numerotation (user_id)
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_user_id ON recurring_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_quote_id ON recurring_contracts(quote_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_docuseal ON recurring_contracts(docuseal_submission_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_contracts_number ON recurring_contracts(contract_number) WHERE contract_number IS NOT NULL;

-- ============================================================
-- 2. quote_sends : support de l'envoi d'un contrat recurrent
--    (reutilisation de l'infra envoi + signature)
-- ============================================================
ALTER TABLE quote_sends ADD COLUMN IF NOT EXISTS recurring_contract_id uuid REFERENCES recurring_contracts(id) ON DELETE CASCADE;
ALTER TABLE quote_sends ADD COLUMN IF NOT EXISTS document_kind text DEFAULT 'quote'; -- 'quote' | 'contract'

CREATE INDEX IF NOT EXISTS idx_quote_sends_contract_id ON quote_sends(recurring_contract_id);

-- Le quote_id devient optionnel pour un envoi de type contract
ALTER TABLE quote_sends ALTER COLUMN quote_id DROP NOT NULL;

-- ============================================================
-- 3. Etendre sign_quote_docuseal pour activer un contrat
--    signe directement (sans devis parent).
-- ============================================================
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
  SELECT * INTO v_send
  FROM quote_sends
  WHERE docuseal_submission_id = p_docuseal_submission_id
  FOR UPDATE;

  IF v_send IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Submission DocuSeal introuvable');
  END IF;

  IF v_send.signed_at IS NOT NULL THEN
    RETURN json_build_object('success', true, 'already_signed', true);
  END IF;

  UPDATE quote_sends
  SET signed_at = now(),
      docuseal_audit_log_url = p_audit_log_url,
      docuseal_signed_document_url = p_signed_document_url,
      docuseal_certificate_url = p_certificate_url,
      signer_ip = p_signer_ip
  WHERE id = v_send.id;

  -- Cas 1 : envoi devis
  IF v_send.quote_id IS NOT NULL THEN
    UPDATE quotes
    SET status = 'accepte',
        signed_at = now(),
        updated_at = now()
    WHERE id = v_send.quote_id;

    UPDATE recurring_contracts
    SET status = 'actif',
        signed_at = now(),
        updated_at = now()
    WHERE quote_id = v_send.quote_id
      AND status = 'en_attente';

    UPDATE leads
    SET stage = 'gagne',
        updated_at = now()
    WHERE quote_id = v_send.quote_id;
  END IF;

  -- Cas 2 : envoi direct d'un contrat
  IF v_send.recurring_contract_id IS NOT NULL THEN
    UPDATE recurring_contracts
    SET status = 'actif',
        signed_at = now(),
        docuseal_submission_id = p_docuseal_submission_id,
        docuseal_submitter_id = p_docuseal_submitter_id,
        docuseal_audit_log_url = p_audit_log_url,
        docuseal_signed_document_url = p_signed_document_url,
        docuseal_certificate_url = p_certificate_url,
        signer_ip = p_signer_ip,
        updated_at = now()
    WHERE id = v_send.recurring_contract_id
      AND status IN ('en_attente', 'brouillon');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
