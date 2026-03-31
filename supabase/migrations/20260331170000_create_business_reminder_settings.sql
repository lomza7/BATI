/*
  # Reglages de rappels chef d'entreprise

  1. Nouvelle table
    - `business_reminder_settings`
      - 1 ligne par utilisateur
      - stocke les informations de TVA, paie, DSN, cloture et regime fiscal

  2. Securite
    - RLS activee
    - chaque utilisateur ne peut lire/modifier que sa propre ligne

  3. Bootstrap
    - creation d'une ligne par defaut pour les utilisateurs existants
    - le trigger `handle_new_user()` cree aussi la ligne pour les nouveaux comptes
*/

CREATE TABLE IF NOT EXISTS public.business_reminder_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  legal_form text DEFAULT '',
  benefit_tax_regime text DEFAULT '',
  vat_regime text DEFAULT '',
  vat_frequency text DEFAULT '',
  vat_reminder_day smallint,
  has_employees boolean NOT NULL DEFAULT false,
  employee_count integer,
  payroll_day smallint,
  dsn_due_day smallint,
  fiscal_year_end_day smallint NOT NULL DEFAULT 31,
  fiscal_year_end_month smallint NOT NULL DEFAULT 12,
  social_contributions_day smallint,
  cfe_applicable boolean NOT NULL DEFAULT true,
  apprenticeship_tax_applicable boolean NOT NULL DEFAULT false,
  accountant_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_reminder_settings_vat_day_check CHECK (
    vat_reminder_day IS NULL OR (vat_reminder_day BETWEEN 1 AND 31)
  ),
  CONSTRAINT business_reminder_settings_payroll_day_check CHECK (
    payroll_day IS NULL OR (payroll_day BETWEEN 1 AND 31)
  ),
  CONSTRAINT business_reminder_settings_dsn_day_check CHECK (
    dsn_due_day IS NULL OR (dsn_due_day BETWEEN 1 AND 31)
  ),
  CONSTRAINT business_reminder_settings_year_end_day_check CHECK (
    fiscal_year_end_day BETWEEN 1 AND 31
  ),
  CONSTRAINT business_reminder_settings_year_end_month_check CHECK (
    fiscal_year_end_month BETWEEN 1 AND 12
  ),
  CONSTRAINT business_reminder_settings_social_day_check CHECK (
    social_contributions_day IS NULL OR (social_contributions_day BETWEEN 1 AND 31)
  )
);

ALTER TABLE public.business_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminder settings"
  ON public.business_reminder_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminder settings"
  ON public.business_reminder_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminder settings"
  ON public.business_reminder_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminder settings"
  ON public.business_reminder_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO public.business_reminder_settings (user_id)
SELECT id
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_business_reminder_settings_user_id
  ON public.business_reminder_settings(user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.business_reminder_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.seed_ai_agents_for_user(NEW.id);
  RETURN NEW;
END;
$$;
