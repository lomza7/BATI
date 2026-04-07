-- ============================================================
-- Migration: 20260407100007_sprint2_column_alignment
-- Description: Align quote_lines / invoice_lines column naming
--   with Sprint 2 service expectations.
--
-- Main schema uses:
--   quote_lines.unit_price  (Sprint 2 expects: unit_price_ht)
--   quote_lines.position    (Sprint 2 expects: sort_order)
--   invoice_lines.unit_price (Sprint 2 expects: unit_price_ht)
--
-- We add aliased columns so Sprint 2 services can write to
-- unit_price_ht and sort_order without breaking existing code
-- that reads unit_price and position.
-- ============================================================

-- quote_lines: add unit_price_ht as alias for unit_price
ALTER TABLE public.quote_lines
  ADD COLUMN IF NOT EXISTS unit_price_ht numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill unit_price_ht and sort_order from existing data
UPDATE public.quote_lines
  SET unit_price_ht = COALESCE(unit_price, 0),
      sort_order = COALESCE(position, 0)
  WHERE unit_price_ht = 0 OR sort_order = 0;

-- invoice_lines: add unit_price_ht as alias for unit_price
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS unit_price_ht numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill invoice_lines
UPDATE public.invoice_lines
  SET unit_price_ht = COALESCE(unit_price, 0),
      sort_order = COALESCE(position, 0)
  WHERE unit_price_ht = 0 OR sort_order = 0;

-- Add total_ht to quote_lines (not a generated column — Sprint 2 writes it directly)
ALTER TABLE public.quote_lines
  ADD COLUMN IF NOT EXISTS total_ht numeric(12,2) NOT NULL DEFAULT 0;

-- Backfill total_ht in quote_lines
UPDATE public.quote_lines
  SET total_ht = COALESCE(quantity * unit_price, 0)
  WHERE total_ht = 0;
