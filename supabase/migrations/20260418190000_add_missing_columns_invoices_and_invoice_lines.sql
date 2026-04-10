-- Ajoute les colonnes manquantes sur invoices et invoice_lines
-- pour supporter le multi-taux TVA et les factures d'acompte/solde.

-- invoices: total_tva, tva_breakdown, description
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS total_tva numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tva_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- Backfill total_tva pour les factures existantes
UPDATE public.invoices
SET total_tva = COALESCE(total_ttc, 0) - COALESCE(total_ht, 0)
WHERE total_tva IS NULL OR total_tva = 0;

-- invoice_lines: tva_rate
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS tva_rate numeric DEFAULT 20;

UPDATE public.invoice_lines SET tva_rate = 20 WHERE tva_rate IS NULL;

COMMENT ON COLUMN public.invoices.total_tva IS 'Montant TVA total de la facture';
COMMENT ON COLUMN public.invoices.tva_breakdown IS 'Détail TVA multi-taux [{rate, base_ht, tva_amount}]';
COMMENT ON COLUMN public.invoices.description IS 'Description libre de la facture';
COMMENT ON COLUMN public.invoice_lines.tva_rate IS 'Taux de TVA appliqué à cette ligne (ex: 5.5, 10, 20)';
