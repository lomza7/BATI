-- Ajoute les colonnes total_tva et tva_breakdown à la table quotes
-- pour stocker le montant TVA calculé et le détail multi-taux,
-- en cohérence avec la table invoices qui a déjà ces colonnes.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS total_tva numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tva_breakdown jsonb;

-- Backfill total_tva pour les devis existants : total_ttc - total_ht
UPDATE public.quotes
SET total_tva = COALESCE(total_ttc, 0) - COALESCE(total_ht, 0)
WHERE total_tva IS NULL OR total_tva = 0;

COMMENT ON COLUMN public.quotes.total_tva IS 'Montant TVA total du devis';
COMMENT ON COLUMN public.quotes.tva_breakdown IS 'Détail TVA multi-taux au format JSON [{rate, base_ht, tva_amount}]';
