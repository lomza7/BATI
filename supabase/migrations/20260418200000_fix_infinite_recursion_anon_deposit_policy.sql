-- La policy "Public can view deposit invoices via final invoice send" cause
-- une récursion infinie car elle SELECT FROM invoices à l'intérieur d'une
-- policy sur invoices. On la remplace par une fonction SECURITY DEFINER
-- qui bypasse les RLS pour la vérification interne.

-- Supprimer l'ancienne policy problématique
DROP POLICY IF EXISTS "Public can view deposit invoices via final invoice send" ON public.invoices;

-- Fonction helper qui vérifie si un quote_id a une facture de solde
-- avec un invoice_send valide, SANS passer par les RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_public_solde_for_quote(p_quote_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoices i
    JOIN public.invoice_sends s ON s.invoice_id = i.id
    WHERE i.quote_id = p_quote_id
      AND i.invoice_type = 'solde'
      AND s.expires_at > now()
  );
$$;

-- Nouvelle policy sans récursion
CREATE POLICY "Public can view deposit invoices via final invoice send"
  ON public.invoices FOR SELECT TO anon
  USING (
    invoice_type = 'acompte'
    AND quote_id IS NOT NULL
    AND public.has_public_solde_for_quote(quote_id)
  );
