-- Extend profiles with Pappers company data

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='siren') THEN
    ALTER TABLE profiles ADD COLUMN siren text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='siret') THEN
    ALTER TABLE profiles ADD COLUMN siret text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='legal_form') THEN
    ALTER TABLE profiles ADD COLUMN legal_form text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='naf_code') THEN
    ALTER TABLE profiles ADD COLUMN naf_code text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='naf_label') THEN
    ALTER TABLE profiles ADD COLUMN naf_label text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='capital') THEN
    ALTER TABLE profiles ADD COLUMN capital numeric DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tva_number') THEN
    ALTER TABLE profiles ADD COLUMN tva_number text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='company_address') THEN
    ALTER TABLE profiles ADD COLUMN company_address text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='company_postal_code') THEN
    ALTER TABLE profiles ADD COLUMN company_postal_code text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='company_website') THEN
    ALTER TABLE profiles ADD COLUMN company_website text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rcs') THEN
    ALTER TABLE profiles ADD COLUMN rcs text DEFAULT '';
  END IF;
END $$;
