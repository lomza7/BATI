-- Contrats recurrents: facturation automatique + historique

-- 1. Nouvelles colonnes sur recurring_contracts
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS auto_send boolean DEFAULT false;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS last_billed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_rc_next_billing ON recurring_contracts(next_billing) WHERE status = 'actif';

-- 2. Table de liaison contrat → facture (historique de facturation)
CREATE TABLE contract_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  contract_id uuid REFERENCES recurring_contracts(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE contract_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_crud" ON contract_invoices FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_contract_invoices_contract ON contract_invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_invoices_user ON contract_invoices(user_id);

-- 3. FK inverse sur invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_contract_id uuid REFERENCES recurring_contracts(id) ON DELETE SET NULL;

-- 4. RPC pour avancer la date de prochaine facturation
CREATE OR REPLACE FUNCTION advance_contract_billing(p_contract_id uuid)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_frequency text; v_next date; v_end_date date;
BEGIN
  SELECT frequency, next_billing, end_date INTO v_frequency, v_next, v_end_date
    FROM recurring_contracts WHERE id = p_contract_id;
  IF v_next IS NULL THEN RETURN NULL; END IF;

  CASE v_frequency
    WHEN 'mensuel' THEN v_next := v_next + INTERVAL '1 month';
    WHEN 'trimestriel' THEN v_next := v_next + INTERVAL '3 months';
    WHEN 'annuel' THEN v_next := v_next + INTERVAL '1 year';
    ELSE v_next := v_next + INTERVAL '1 month';
  END CASE;

  IF v_end_date IS NOT NULL AND v_next > v_end_date THEN
    UPDATE recurring_contracts SET status = 'resilie', cancelled_at = now(), next_billing = NULL, updated_at = now()
      WHERE id = p_contract_id;
    RETURN NULL;
  END IF;

  UPDATE recurring_contracts SET next_billing = v_next, last_billed_at = now(), updated_at = now()
    WHERE id = p_contract_id;
  RETURN v_next;
END;
$$;

-- 5. Commission a 1%
UPDATE platform_config SET value = '1' WHERE key = 'stripe_connect_fee_percent';
