-- Phase 8.3 — RBAC admin via DB au lieu d'un email hardcodé.
-- Crée profiles.is_admin + une fonction is_admin() utilisable dans
-- les policies et les checks applicatifs. Backfill avec l'admin
-- actuel (louis@maaza.pro) pour préserver l'accès existant.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

UPDATE profiles p
SET is_admin = true
FROM auth.users u
WHERE p.id = u.id
  AND u.email = 'louis@maaza.pro'
  AND p.is_admin = false;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

NOTIFY pgrst, 'reload schema';
