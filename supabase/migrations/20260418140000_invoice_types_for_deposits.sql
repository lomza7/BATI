-- Ajoute la notion de "type de facture" pour supporter les factures d'acompte
-- et les factures de solde. Conformite BTP : numerotation unique partagee,
-- groupement par quote_id.

ALTER TABLE public.invoices
  ADD COLUMN invoice_type text NOT NULL DEFAULT 'standard'
    CHECK (invoice_type IN ('standard', 'acompte', 'solde')),
  ADD COLUMN deposit_percentage numeric(5,2) CHECK (deposit_percentage > 0 AND deposit_percentage <= 100);

-- Un acompte ou un solde DOIT etre rattache a un devis
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_acompte_solde_requires_quote
  CHECK (invoice_type = 'standard' OR quote_id IS NOT NULL);

-- Index pour la requete "toutes les factures liees a un devis"
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id_type
  ON public.invoices (quote_id, invoice_type)
  WHERE quote_id IS NOT NULL;

COMMENT ON COLUMN public.invoices.invoice_type IS
  'Type de facture : standard (facture classique), acompte (facture d''acompte partielle), solde (facture finale deduisant les acomptes)';

COMMENT ON COLUMN public.invoices.deposit_percentage IS
  'Pour invoice_type = acompte : pourcentage du devis facture (info uniquement, montant reel calcule dans total_ht)';
