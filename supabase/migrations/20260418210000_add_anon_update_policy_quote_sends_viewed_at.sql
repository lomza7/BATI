-- Permet au rôle anon de mettre à jour viewed_at sur quote_sends
-- quand un client ouvre le lien de signature du devis.

CREATE POLICY "Anon can mark quote send as viewed"
  ON public.quote_sends FOR UPDATE TO anon
  USING (
    token IS NOT NULL
    AND expires_at > now()
  )
  WITH CHECK (
    token IS NOT NULL
    AND expires_at > now()
  );

NOTIFY pgrst, 'reload schema';
