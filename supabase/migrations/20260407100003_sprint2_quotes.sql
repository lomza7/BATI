-- ============================================================
-- Migration: 20260407100003_sprint2_quotes
-- Description: Sprint 2 — Quote restructuration
--   - Enrich quotes table (lots, versioning, soft-delete, PDF)
--   - Create quote_lots table (grouping of line items)
--   - Enrich quote_lines with lot_id and per-line TVA rate
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enrich quotes table
-- ------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS object text,
  ADD COLUMN IF NOT EXISTS site_address text,
  ADD COLUMN IF NOT EXISTS site_city text,
  ADD COLUMN IF NOT EXISTS site_postal_code text,
  ADD COLUMN IF NOT EXISTS is_renovation_2yr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_conditions text DEFAULT 'Paiement à 30 jours',
  ADD COLUMN IF NOT EXISTS validity_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_quote_id uuid REFERENCES public.quotes(id),
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS sent_to_email text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Remove global tva_rate from quotes (TVA is now per line)
ALTER TABLE public.quotes DROP COLUMN IF EXISTS tva_rate;

-- ------------------------------------------------------------
-- 2. Create quote_lots table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_lots_quote_id ON public.quote_lots(quote_id);

-- ------------------------------------------------------------
-- 3. Enrich quote_lines with lot_id and per-line TVA rate
-- ------------------------------------------------------------
ALTER TABLE public.quote_lines
  ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES public.quote_lots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2) NOT NULL DEFAULT 20.0;

CREATE INDEX IF NOT EXISTS idx_quote_lines_lot_id ON public.quote_lines(lot_id);

-- ------------------------------------------------------------
-- 4. Performance indexes on quotes
-- ------------------------------------------------------------
-- Partial index for non-deleted quotes
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON public.quotes(deleted_at)
  WHERE deleted_at IS NULL;

-- Status index for dashboard filters
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status)
  WHERE deleted_at IS NULL;

-- Client lookup index
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes(client_id)
  WHERE deleted_at IS NULL;
