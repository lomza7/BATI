-- Ajoute deposit_percentage a la table quotes.
-- L'artisan peut definir un % d'acompte sur le devis, qui est ensuite
-- utilise pour generer une facture d'acompte (voir invoice_type='acompte').
-- Le code (devis/nouveau, devis/modifier, document-preview-dialog)
-- lit et ecrit deja cette colonne — elle manquait simplement en DB.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS deposit_percentage numeric(5,2)
    CHECK (deposit_percentage > 0 AND deposit_percentage <= 100);

COMMENT ON COLUMN public.quotes.deposit_percentage IS
  'Pourcentage d''acompte prevu sur le devis (optionnel, entre 0 et 100)';

-- Rafraichit le cache de schema PostgREST
NOTIFY pgrst, 'reload schema';
