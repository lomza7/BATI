-- ============================================================
-- Site vitrine artisan — telephone public affiche a cote du CTA
-- ============================================================
-- Permet a l'artisan de specifier un telephone distinct de company_phone
-- a afficher sur son site public, a cote du bouton "Demander un devis".

ALTER TABLE public.artisan_sites
  ADD COLUMN IF NOT EXISTS public_phone text NOT NULL DEFAULT '';
