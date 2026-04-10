-- Ajoute la colonne tva_rate sur quote_lines pour supporter le multi-taux TVA par ligne.
-- Défaut 20% (taux standard français).

ALTER TABLE public.quote_lines
  ADD COLUMN IF NOT EXISTS tva_rate numeric DEFAULT 20;

-- Backfill : toutes les lignes existantes à 20% (taux par défaut)
UPDATE public.quote_lines SET tva_rate = 20 WHERE tva_rate IS NULL;

COMMENT ON COLUMN public.quote_lines.tva_rate IS 'Taux de TVA appliqué à cette ligne (ex: 5.5, 10, 20)';
