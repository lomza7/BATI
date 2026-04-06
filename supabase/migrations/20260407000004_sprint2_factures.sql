-- ============================================================
-- Migration: 20260407000004_sprint2_factures
-- Description: Sprint 2 — module factures complet
--   - Restructuration table factures (lots, lignes, situations, avoir)
--   - Immutabilité post-émission (trigger whitelist)
--   - Numérotation séquentielle FAC/SIT/AVO
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enrichissement table factures
-- ------------------------------------------------------------
ALTER TABLE public.factures
  -- Type de facture
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'facture'
    CHECK (type IN ('facture', 'situation', 'avoir')),
  -- Lien avoir → facture d'origine
  ADD COLUMN IF NOT EXISTS parent_facture_id uuid REFERENCES public.factures(id),
  -- Titre / objet
  ADD COLUMN IF NOT EXISTS object text,
  -- Adresse chantier
  ADD COLUMN IF NOT EXISTS site_address text,
  ADD COLUMN IF NOT EXISTS site_city text,
  ADD COLUMN IF NOT EXISTS site_postal_code text,
  -- Remise + acompte déduit
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount_deducted numeric(12,2) NOT NULL DEFAULT 0,
  -- Conditions de paiement (texte libre)
  ADD COLUMN IF NOT EXISTS payment_conditions text DEFAULT 'Paiement à 30 jours',
  -- Situation finale
  ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false,
  -- Méthode de paiement
  ADD COLUMN IF NOT EXISTS payment_method text,
  -- Timestamps émission / envoi
  ADD COLUMN IF NOT EXISTS emitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_email text,
  -- PDF + XML Factur-X (stocké en DB pour les petites tailles, sinon url)
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS facturx_xml text,
  -- Auto-entrepreneur
  ADD COLUMN IF NOT EXISTS is_auto_entrepreneur_invoice boolean NOT NULL DEFAULT false,
  -- Soft delete
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Supprimer tva_rate unique (la TVA sera par poste)
ALTER TABLE public.factures DROP COLUMN IF EXISTS tva_rate;
-- Supprimer stripe_payment_intent_id (hors scope sprint 2)
ALTER TABLE public.factures DROP COLUMN IF EXISTS stripe_payment_intent_id;
-- Supprimer champs e_invoice_* redondants avec facturx_xml
ALTER TABLE public.factures DROP COLUMN IF EXISTS e_invoice_format;
ALTER TABLE public.factures DROP COLUMN IF EXISTS e_invoice_status;
ALTER TABLE public.factures DROP COLUMN IF EXISTS e_invoice_submitted_at;

-- payment_terms_days renommé conceptuellement, on garde tel quel

-- ------------------------------------------------------------
-- 2. Table facture_lots (groupes de postes, comme devis_lots)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facture_lots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id uuid NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Montant HT total du lot (utilisé pour calcul situations)
  montant_lot_ht numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facture_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage lots of their own factures" ON public.facture_lots;
CREATE POLICY "Users can manage lots of their own factures"
  ON public.facture_lots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.factures f
      WHERE f.id = facture_id AND f.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_facture_lots_facture_id ON public.facture_lots(facture_id);

-- ------------------------------------------------------------
-- 3. Table facture_lignes (postes de facturation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facture_lignes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id uuid NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES public.facture_lots(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit text DEFAULT 'u',
  unit_price_ht numeric(12,2) NOT NULL DEFAULT 0,
  tva_rate numeric(5,2) NOT NULL DEFAULT 20.0,
  -- Pour les avoirs, quantity peut être négative
  total_ht numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price_ht) STORED,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facture_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage lignes of their own factures" ON public.facture_lignes;
CREATE POLICY "Users can manage lignes of their own factures"
  ON public.facture_lignes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.factures f
      WHERE f.id = facture_id AND f.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_facture_lignes_facture_id ON public.facture_lignes(facture_id);
CREATE INDEX IF NOT EXISTS idx_facture_lignes_lot_id ON public.facture_lignes(lot_id);

-- ------------------------------------------------------------
-- 4. Table facture_situations (suivi avancement par lot)
-- Stocke le cumul pour calculer les situations successives
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facture_situations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Facture principale (celle dont sont issues les situations)
  facture_mere_id uuid NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  -- Facture de situation émise
  facture_situation_id uuid NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.facture_lots(id) ON DELETE CASCADE,
  avancement_percent numeric(5,2) NOT NULL CHECK (avancement_percent >= 0 AND avancement_percent <= 100),
  cumul_precedent_percent numeric(5,2) NOT NULL DEFAULT 0,
  montant_situation_ht numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(facture_situation_id, lot_id)
);

ALTER TABLE public.facture_situations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their facture_situations" ON public.facture_situations;
CREATE POLICY "Users can manage their facture_situations"
  ON public.facture_situations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.factures f
      WHERE f.id = facture_mere_id AND f.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_facture_situations_mere ON public.facture_situations(facture_mere_id);
CREATE INDEX IF NOT EXISTS idx_facture_situations_lot ON public.facture_situations(lot_id);

-- ------------------------------------------------------------
-- 5. Trigger d'immuabilité post-émission
-- Seuls status, paid_at, payment_method, pdf_url, updated_at
-- sont modifiables après émission.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_facture_immutability()
RETURNS trigger AS $$
BEGIN
  -- Pas de restriction sur les brouillons
  IF OLD.status = 'brouillon' THEN
    RETURN NEW;
  END IF;

  -- Colonnes autorisées après émission
  IF NEW.reference        IS DISTINCT FROM OLD.reference        OR
     NEW.title            IS DISTINCT FROM OLD.title            OR
     NEW.type             IS DISTINCT FROM OLD.type             OR
     NEW.client_id        IS DISTINCT FROM OLD.client_id        OR
     NEW.devis_id         IS DISTINCT FROM OLD.devis_id         OR
     NEW.parent_facture_id IS DISTINCT FROM OLD.parent_facture_id OR
     NEW.total_ht         IS DISTINCT FROM OLD.total_ht         OR
     NEW.total_tva        IS DISTINCT FROM OLD.total_tva        OR
     NEW.total_ttc        IS DISTINCT FROM OLD.total_ttc        OR
     NEW.discount_percent IS DISTINCT FROM OLD.discount_percent OR
     NEW.deposit_amount_deducted IS DISTINCT FROM OLD.deposit_amount_deducted OR
     NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days OR
     NEW.due_date         IS DISTINCT FROM OLD.due_date         OR
     NEW.facturx_xml      IS DISTINCT FROM OLD.facturx_xml      OR
     NEW.is_auto_entrepreneur_invoice IS DISTINCT FROM OLD.is_auto_entrepreneur_invoice OR
     NEW.emitted_at       IS DISTINCT FROM OLD.emitted_at
  THEN
    RAISE EXCEPTION 'Facture émise : seuls status, paid_at, payment_method, pdf_url et sent_to_email sont modifiables.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_facture_immutability_trigger ON public.factures;
CREATE TRIGGER check_facture_immutability_trigger
  BEFORE UPDATE ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.check_facture_immutability();

-- ------------------------------------------------------------
-- 6. Trigger updated_at pour facture_lots
-- ------------------------------------------------------------
CREATE TRIGGER handle_facture_lots_updated_at
  BEFORE UPDATE ON public.facture_lots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------
-- 7. Index supplémentaires sur factures
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_factures_deleted_at ON public.factures(deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_factures_client_id ON public.factures(client_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_factures_devis_id ON public.factures(devis_id);

CREATE INDEX IF NOT EXISTS idx_factures_type ON public.factures(type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_factures_due_date ON public.factures(due_date)
  WHERE deleted_at IS NULL AND status IN ('émise', 'envoyée');
