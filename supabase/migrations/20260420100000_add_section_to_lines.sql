-- Add section column to quote_lines and invoice_lines
-- Allows grouping lines into "materiel" (supplies) and "main_oeuvre" (labor)
-- NULL = legacy/flat display (backward compatible)

ALTER TABLE public.quote_lines
  ADD COLUMN IF NOT EXISTS section text DEFAULT NULL;

ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS section text DEFAULT NULL;
