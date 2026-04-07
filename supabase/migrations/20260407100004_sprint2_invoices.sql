-- ============================================================
-- Migration: 20260407100004_sprint2_invoices
-- Description: Sprint 2 — Full invoice module
--   - Enrich invoices table (type, lots, situations, credit notes)
--   - Create invoice_lots table
--   - Enrich invoice_lines (lot_id, tva_rate, total_ht generated)
--   - Create invoice_situations table (progress billing)
--   - Immutability trigger (post-emission whitelist)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enrich invoices table
-- ------------------------------------------------------------
ALTER TABLE public.invoices
  -- Invoice type (regular, progress billing, credit note)
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'invoice'
    CHECK (type IN ('invoice', 'situation', 'credit_note')),
  -- Link credit note → original invoice
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid REFERENCES public.invoices(id),
  -- Object / title
  ADD COLUMN IF NOT EXISTS object text,
  -- Site address
  ADD COLUMN IF NOT EXISTS site_address text,
  ADD COLUMN IF NOT EXISTS site_city text,
  ADD COLUMN IF NOT EXISTS site_postal_code text,
  -- Discount and deposit deducted
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount_deducted numeric(12,2) NOT NULL DEFAULT 0,
  -- Payment conditions (free text)
  ADD COLUMN IF NOT EXISTS payment_conditions text DEFAULT 'Paiement à 30 jours',
  -- Final situation flag
  ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false,
  -- Emission and send timestamps
  ADD COLUMN IF NOT EXISTS emitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_email text,
  -- Factur-X XML (stored in DB for small size, else url)
  ADD COLUMN IF NOT EXISTS facturx_xml text,
  -- Auto-entrepreneur invoice (no TVA)
  ADD COLUMN IF NOT EXISTS is_auto_entrepreneur_invoice boolean NOT NULL DEFAULT false,
  -- Soft delete
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Note: payment_method, pdf_url, stripe_payment_intent_id already exist from
-- previous migrations (stripe_connect, invoice_compliance). Not re-added.

-- ------------------------------------------------------------
-- 2. Create invoice_lots table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Total HT for this lot (used for progress billing calculations)
  montant_lot_ht numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lots_invoice_id ON public.invoice_lots(invoice_id);

-- ------------------------------------------------------------
-- 3. Enrich invoice_lines (existing table)
-- ------------------------------------------------------------
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES public.invoice_lots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2) NOT NULL DEFAULT 20.0,
  -- Generated column: quantity × unit_price (stored for query performance)
  ADD COLUMN IF NOT EXISTS total_ht numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED;

CREATE INDEX IF NOT EXISTS idx_invoice_lines_lot_id ON public.invoice_lines(lot_id);

-- ------------------------------------------------------------
-- 4. Create invoice_situations table (progress billing tracking)
-- Tracks cumulative progress per lot for successive billing situations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_situations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Parent invoice (the base invoice from which situations are derived)
  parent_invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  -- The situation invoice emitted
  situation_invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.invoice_lots(id) ON DELETE CASCADE,
  avancement_percent numeric(5,2) NOT NULL CHECK (avancement_percent >= 0 AND avancement_percent <= 100),
  cumul_precedent_percent numeric(5,2) NOT NULL DEFAULT 0,
  montant_situation_ht numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(situation_invoice_id, lot_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_situations_parent ON public.invoice_situations(parent_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_situations_lot ON public.invoice_situations(lot_id);

-- ------------------------------------------------------------
-- 5. Immutability trigger (post-emission whitelist)
-- After emission, only status, paid_at, payment_method,
-- pdf_url, sent_to_email, and updated_at are modifiable.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_invoice_immutability()
RETURNS trigger AS $$
BEGIN
  -- No restriction on draft invoices
  IF OLD.status = 'brouillon' THEN
    RETURN NEW;
  END IF;

  -- Allow if not yet emitted
  IF OLD.emitted_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reject changes to immutable columns after emission
  IF NEW.invoice_number    IS DISTINCT FROM OLD.invoice_number    OR
     NEW.title             IS DISTINCT FROM OLD.title             OR
     NEW.type              IS DISTINCT FROM OLD.type              OR
     NEW.client_id         IS DISTINCT FROM OLD.client_id         OR
     NEW.quote_id          IS DISTINCT FROM OLD.quote_id          OR
     NEW.parent_invoice_id IS DISTINCT FROM OLD.parent_invoice_id OR
     NEW.total_ht          IS DISTINCT FROM OLD.total_ht          OR
     NEW.total_ttc         IS DISTINCT FROM OLD.total_ttc         OR
     NEW.discount_percent  IS DISTINCT FROM OLD.discount_percent  OR
     NEW.deposit_amount_deducted IS DISTINCT FROM OLD.deposit_amount_deducted OR
     NEW.due_date          IS DISTINCT FROM OLD.due_date          OR
     NEW.facturx_xml       IS DISTINCT FROM OLD.facturx_xml       OR
     NEW.is_auto_entrepreneur_invoice IS DISTINCT FROM OLD.is_auto_entrepreneur_invoice OR
     NEW.emitted_at        IS DISTINCT FROM OLD.emitted_at
  THEN
    RAISE EXCEPTION 'Invoice emitted: only status, paid_at, payment_method, pdf_url and sent_to_email are modifiable.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_invoice_immutability_trigger ON public.invoices;
CREATE TRIGGER check_invoice_immutability_trigger
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_invoice_immutability();

-- ------------------------------------------------------------
-- 6. Performance indexes on invoices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices(deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date)
  WHERE deleted_at IS NULL AND status IN ('émise', 'envoyée', 'sent');
