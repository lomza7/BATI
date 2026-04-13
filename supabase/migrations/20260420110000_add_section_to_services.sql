-- Add section column to services for materiel/main_oeuvre distinction
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS section text DEFAULT 'materiel';
