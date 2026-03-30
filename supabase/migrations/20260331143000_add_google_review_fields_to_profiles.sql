DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'google_business_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_business_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'google_business_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_business_url text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'google_review_link'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_review_link text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'google_place_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_place_id text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'google_connection_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_connection_status text DEFAULT 'not_connected';
  END IF;
END $$;
