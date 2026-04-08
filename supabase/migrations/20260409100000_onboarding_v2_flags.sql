-- Onboarding V2 : ajoute les flags collectes durant le parcours enrichi
-- (site web existant, site Hellobat opt-in, Maurice opt-in, step courant)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_existing_website boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_hellobat_site boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_maurice_accounting boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step smallint DEFAULT 0;

COMMENT ON COLUMN profiles.has_existing_website IS 'Onboarding V2 : l''artisan declare avoir deja un site web externe';
COMMENT ON COLUMN profiles.wants_hellobat_site IS 'Onboarding V2 : l''artisan veut generer son site Hellobat automatiquement';
COMMENT ON COLUMN profiles.wants_maurice_accounting IS 'Onboarding V2 : l''artisan souhaite activer la comptabilite IA Maurice';
COMMENT ON COLUMN profiles.onboarding_step IS 'Onboarding V2 : derniere etape atteinte (pour analytics et reprise)';
