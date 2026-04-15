-- Phase 2.D — Révocation de l'UPLOAD anon sur le bucket `signatures`.
-- Pré-requis : la route /api/public/sign-quote doit être déployée et
-- utilisée par la page /d/[token] — elle upload la signature côté serveur
-- via supabaseAdmin après vérification du token.
-- La lecture publique (SELECT) reste ouverte pour l'instant, car les
-- devis déjà signés ont leur URL publique stockée en DB. Passer en privé
-- complet nécessite une seconde migration + signed URL à la demande.

DROP POLICY IF EXISTS "Anon can upload signatures" ON storage.objects;

NOTIFY pgrst, 'reload schema';
