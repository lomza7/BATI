-- Stripe Connect: paiement en ligne sur factures

-- 1. Table connexions Stripe Connect
CREATE TABLE stripe_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_account_id text NOT NULL,
  charges_enabled boolean DEFAULT false,
  payouts_enabled boolean DEFAULT false,
  details_submitted boolean DEFAULT false,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE stripe_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_crud" ON stripe_connections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Table envois de factures (pattern quote_sends)
CREATE TABLE invoice_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL DEFAULT '',
  client_email text DEFAULT '',
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  viewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE invoice_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_crud" ON invoice_sends FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anon_view_valid" ON invoice_sends FOR SELECT TO anon
  USING (token IS NOT NULL AND expires_at > now());

-- 3. Colonnes paiement sur invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method text DEFAULT '';

-- 4. Acces anon aux factures via token
CREATE POLICY "anon_view_invoice_via_send" ON invoices FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM invoice_sends
    WHERE invoice_sends.invoice_id = invoices.id
      AND invoice_sends.expires_at > now()
  ));
CREATE POLICY "anon_view_invoice_lines_via_send" ON invoice_lines FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM invoice_sends
    JOIN invoices ON invoices.id = invoice_sends.invoice_id
    WHERE invoices.id = invoice_lines.invoice_id
      AND invoice_sends.expires_at > now()
  ));

-- Acces anon au profil artisan via invoice_sends (pour afficher l'en-tete)
CREATE POLICY "anon_view_profile_via_invoice_send" ON profiles FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM invoice_sends
    WHERE invoice_sends.user_id = profiles.id
      AND invoice_sends.expires_at > now()
  ));

-- Acces anon aux clients via invoice_sends (pour afficher le destinataire)
CREATE POLICY "anon_view_client_via_invoice_send" ON clients FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM invoices
    JOIN invoice_sends ON invoice_sends.invoice_id = invoices.id
    WHERE invoices.client_id = clients.id
      AND invoice_sends.expires_at > now()
  ));

-- Acces anon a stripe_connections (pour savoir si paiement dispo)
CREATE POLICY "anon_view_stripe_via_invoice_send" ON stripe_connections FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM invoice_sends
    WHERE invoice_sends.user_id = stripe_connections.user_id
      AND invoice_sends.expires_at > now()
  ));

-- 5. Commission dans platform_config
INSERT INTO platform_config (key, value, label) VALUES
  ('stripe_connect_fee_percent', '2.5', 'Commission plateforme Stripe Connect (%)')
ON CONFLICT (key) DO NOTHING;

-- 6. RPC pour marquer facture payee (appelee par webhook)
CREATE OR REPLACE FUNCTION mark_invoice_paid(
  p_invoice_id uuid,
  p_payment_intent_id text,
  p_checkout_session_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE invoices SET
    status = 'payee',
    paid_at = now(),
    stripe_payment_intent_id = p_payment_intent_id,
    stripe_checkout_session_id = p_checkout_session_id,
    payment_method = 'stripe'
  WHERE id = p_invoice_id AND status != 'payee';

  UPDATE invoice_sends SET paid_at = now()
  WHERE invoice_id = p_invoice_id AND paid_at IS NULL;
END;
$$;
