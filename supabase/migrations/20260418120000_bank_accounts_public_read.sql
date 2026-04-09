-- Permettre la lecture anonyme d'un RIB via un envoi de devis ou facture valide.
-- Le pattern mirror ce qui est fait pour quotes/clients/profiles via quote_sends
-- et invoice_sends, pour que les pages publiques /d/[token] et /f/[token]
-- puissent afficher les coordonnees bancaires de l'artisan.

-- Acces public aux RIB via un envoi de devis valide
CREATE POLICY "Public can view bank_accounts via valid quote send"
  ON public.bank_accounts FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotes q
      JOIN public.quote_sends qs ON qs.quote_id = q.id
      WHERE q.bank_account_id = bank_accounts.id
        AND qs.expires_at > now()
    )
  );

-- Acces public aux RIB via un envoi de facture valide
CREATE POLICY "Public can view bank_accounts via valid invoice send"
  ON public.bank_accounts FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices inv
      JOIN public.invoice_sends inv_s ON inv_s.invoice_id = inv.id
      WHERE inv.bank_account_id = bank_accounts.id
        AND inv_s.expires_at > now()
    )
  );
