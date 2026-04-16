-- Add subsection column to quote_lines and invoice_lines
-- Allows a 2-level hierarchy : section ("Salle de bains") > subsection ("Materiel" / "Main d'oeuvre") > lines
-- NULL = legacy/flat display under the section (backward compatible — existing quotes/invoices unaffected)

ALTER TABLE public.quote_lines
  ADD COLUMN IF NOT EXISTS subsection text DEFAULT NULL;

ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS subsection text DEFAULT NULL;
