-- ============================================================
-- Fix: qualify gen_random_bytes with the extensions schema.
-- The signup trigger create_referral_code_after_user_insert was
-- failing with "function gen_random_bytes(integer) does not exist"
-- because the auth session search_path does not include extensions.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
BEGIN
  LOOP
    v_code := upper(translate(substring(encode(extensions.gen_random_bytes(8), 'base64') from 1 for 8), '+/=OI01lo', 'ABCDEFGHJ'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Impossible de generer un code unique';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
  v_attempts int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = v_user_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  LOOP
    v_code := upper(translate(substring(encode(extensions.gen_random_bytes(8), 'base64') from 1 for 8), '+/=OI01lo', 'ABCDEFGHJ'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Impossible de generer un code unique';
    END IF;
  END LOOP;

  INSERT INTO public.referral_codes (user_id, code) VALUES (v_user_id, v_code);
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;
