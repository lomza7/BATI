-- Permet la lecture anonyme des factures d'acompte liees a une facture de solde
-- accessible via un token d'envoi valide, pour afficher le detail de deduction
-- sur la vue publique /f/[token].
CREATE POLICY "Public can view deposit invoices via final invoice send"
  ON public.invoices FOR SELECT TO anon
  USING (
    invoice_type = 'acompte'
    AND EXISTS (
      SELECT 1
      FROM public.invoices final_inv
      JOIN public.invoice_sends inv_s ON inv_s.invoice_id = final_inv.id
      WHERE final_inv.quote_id = invoices.quote_id
        AND final_inv.invoice_type = 'solde'
        AND inv_s.expires_at > now()
    )
  );
