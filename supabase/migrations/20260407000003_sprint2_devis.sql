-- ============================================================
-- Migration: 20260407000003_sprint2_devis
-- Description: Sprint 2 — devis restructuration lots/postes,
--              reference_counters, profil artisan champs legaux
-- ============================================================

-- ------------------------------------------------------------
-- 0. Profil artisan — champs légaux (prérequis mentions légales)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS insurance_decennale_number text,
  ADD COLUMN IF NOT EXISTS insurance_decennale_company text,
  ADD COLUMN IF NOT EXISTS insurance_decennale_expiry date,
  ADD COLUMN IF NOT EXISTS rge_number text,
  ADD COLUMN IF NOT EXISTS rge_valid_until date,
  ADD COLUMN IF NOT EXISTS is_auto_entrepreneur boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tva_number text;

-- ------------------------------------------------------------
-- 1. Devis — enrichissement colonnes
-- ------------------------------------------------------------
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS object text,
  ADD COLUMN IF NOT EXISTS site_address text,
  ADD COLUMN IF NOT EXISTS site_city text,
  ADD COLUMN IF NOT EXISTS site_postal_code text,
  ADD COLUMN IF NOT EXISTS is_renovation_2yr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_percent numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_conditions text DEFAULT 'Paiement à 30 jours',
  ADD COLUMN IF NOT EXISTS validity_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_devis_id uuid REFERENCES public.devis(id),
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS sent_to_email text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Supprimer tva_rate unique (la TVA est maintenant par poste)
ALTER TABLE public.devis DROP COLUMN IF EXISTS tva_rate;

-- Ajouter statut 'facturé' à l'enum devis_status
ALTER TYPE public.devis_status ADD VALUE IF NOT EXISTS 'facturé';

-- ------------------------------------------------------------
-- 2. Table devis_lots
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.devis_lots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  devis_id uuid NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devis_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage lots of their own devis" ON public.devis_lots;
CREATE POLICY "Users can manage lots of their own devis"
  ON public.devis_lots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.devis d
      WHERE d.id = devis_id AND d.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_devis_lots_devis_id ON public.devis_lots(devis_id);

-- ------------------------------------------------------------
-- 3. Devis lignes — ajout lot_id et tva_rate par poste
-- ------------------------------------------------------------
ALTER TABLE public.devis_lignes
  ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES public.devis_lots(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2) NOT NULL DEFAULT 20.0;

CREATE INDEX IF NOT EXISTS idx_devis_lignes_lot_id ON public.devis_lignes(lot_id);

-- Partial index for non-deleted devis
CREATE INDEX IF NOT EXISTS idx_devis_deleted_at ON public.devis(deleted_at)
  WHERE deleted_at IS NULL;

-- Index statut pour filtres dashboard
CREATE INDEX IF NOT EXISTS idx_devis_status ON public.devis(status)
  WHERE deleted_at IS NULL;

-- Index client_id pour lookups depuis client
CREATE INDEX IF NOT EXISTS idx_devis_client_id ON public.devis(client_id)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 4. Table reference_counters (numérotation séquentielle)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reference_counters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  counter_type text NOT NULL CHECK (counter_type IN ('devis', 'facture', 'situation', 'avoir')),
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, counter_type, year)
);

ALTER TABLE public.reference_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their counters" ON public.reference_counters;
CREATE POLICY "Users can manage their counters"
  ON public.reference_counters FOR ALL
  USING (auth.uid() = user_id);
