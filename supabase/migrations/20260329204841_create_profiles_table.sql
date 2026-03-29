/*
  # Creation de la table profiles pour l'onboarding utilisateur

  1. Nouvelles tables
    - `profiles`
      - `id` (uuid, PK, FK auth.users) - Lie au compte Supabase Auth
      - `full_name` (text) - Nom complet du client
      - `company_name` (text) - Nom de l'entreprise
      - `company_activity` (text) - Activite (plomberie, electricite, etc.)
      - `company_city` (text) - Ville de l'entreprise
      - `company_phone` (text) - Telephone de l'entreprise
      - `team_size` (text) - Taille de l'equipe (seul, 2-5, 6-10, 10+)
      - `referral_source` (text) - Comment ils ont entendu parler de nous
      - `onboarding_completed` (boolean) - Si l'onboarding est termine
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `onboarding_team_members`
      - `id` (uuid, PK)
      - `profile_id` (uuid, FK profiles) - Lie au profil
      - `name` (text) - Nom du membre
      - `role` (text) - Poste dans l'entreprise
      - `created_at` (timestamptz)

  2. Securite
    - RLS active sur les deux tables
    - Les utilisateurs ne peuvent voir/modifier que leur propre profil
    - Les utilisateurs ne peuvent voir/modifier que les membres de leur equipe

  3. Notes
    - Le profil est cree automatiquement via un trigger a l'inscription
    - L'onboarding est marque comme non complete par defaut
*/

-- Table profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  company_name text DEFAULT '',
  company_activity text DEFAULT '',
  company_city text DEFAULT '',
  company_phone text DEFAULT '',
  team_size text DEFAULT 'seul',
  referral_source text DEFAULT '',
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Table onboarding_team_members
CREATE TABLE IF NOT EXISTS onboarding_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  role text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE onboarding_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team members"
  ON onboarding_team_members FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own team members"
  ON onboarding_team_members FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own team members"
  ON onboarding_team_members FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own team members"
  ON onboarding_team_members FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- Trigger pour creer automatiquement un profil a l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_onboarding_team_members_profile ON onboarding_team_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON profiles(onboarding_completed);
