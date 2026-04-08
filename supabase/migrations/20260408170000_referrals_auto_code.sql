-- ============================================================
-- Generate a referral code for every user automatically:
-- 1. Function to generate a unique short code
-- 2. Trigger on auth.users insert
-- 3. Backfill existing users
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
BEGIN
  LOOP
    v_code := upper(translate(substring(encode(gen_random_bytes(8), 'base64') from 1 for 8), '+/=OI01lo', 'ABCDEFGHJ'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Impossible de generer un code unique';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_referral_code_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, public.generate_unique_referral_code())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_referral_code_after_user_insert ON auth.users;
CREATE TRIGGER create_referral_code_after_user_insert
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_referral_code_for_new_user();

-- Backfill existing users
DO $$
DECLARE
  u record;
BEGIN
  FOR u IN
    SELECT id FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.referral_codes)
  LOOP
    INSERT INTO public.referral_codes (user_id, code)
    VALUES (u.id, public.generate_unique_referral_code())
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;
