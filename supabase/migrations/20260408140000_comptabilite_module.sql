-- ============================================================
-- Comptabilité IA module
-- 1. Enrich expenses (HT/TVA/breakdown/payment/source/OCR/project)
-- 2. New table expense_categories (per-user, seedable)
-- 3. New table accountant_access (magic link for read-only access)
-- 4. New storage bucket "receipts" with workspace RLS
-- 5. Extend business_reminder_settings with TVA method
-- 6. Bump starter AI quota to 100k tokens (OCR is hungry)
-- ============================================================

-- ============================================================
-- 1. Enrich expenses
-- ============================================================

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_category_id uuid,
  ADD COLUMN IF NOT EXISTS amount_ht numeric(12,2),
  ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS tva_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS is_autoliquidation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ocr_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS receipt_storage_path text,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'fiscal_year'
  ) THEN
    ALTER TABLE public.expenses
      ADD COLUMN fiscal_year int GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.expenses'::regclass AND conname = 'expenses_source_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_source_check CHECK (source IN ('manual', 'ocr', 'recurring'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.expenses'::regclass AND conname = 'expenses_payment_method_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_payment_method_check CHECK (
        payment_method IS NULL
        OR payment_method IN ('cb', 'virement', 'especes', 'cheque', 'prelevement', 'autre')
      );
  END IF;
END $$;

-- Backfill amount_ht from amount/tva_amount when possible
UPDATE public.expenses
SET amount_ht = amount - COALESCE(tva_amount, 0)
WHERE amount_ht IS NULL AND amount IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_fiscal_year ON public.expenses(user_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON public.expenses(project_id) WHERE project_id IS NOT NULL;

-- Drop legacy "Users can ..." policies (workspace policies cover them)
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_expense_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_expense_updated_at_before_update ON public.expenses;
CREATE TRIGGER touch_expense_updated_at_before_update
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.touch_expense_updated_at();

-- ============================================================
-- 2. expense_categories
-- ============================================================

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  slug text NOT NULL,
  name text NOT NULL,
  pcg_account text,
  color text DEFAULT 'slate',
  sort_order int DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_categories_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT expense_categories_unique_slug UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_user
  ON public.expense_categories(user_id, sort_order, name);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- We'll add the workspace trigger AFTER backfilling, otherwise the trigger
-- overwrites user_id with current_workspace_user_id() (= NULL during migrations).
DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.expense_categories;

DROP POLICY IF EXISTS workspace_select ON public.expense_categories;
DROP POLICY IF EXISTS workspace_insert ON public.expense_categories;
DROP POLICY IF EXISTS workspace_update ON public.expense_categories;
DROP POLICY IF EXISTS workspace_delete ON public.expense_categories;

CREATE POLICY workspace_select
  ON public.expense_categories FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert
  ON public.expense_categories FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update
  ON public.expense_categories FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete
  ON public.expense_categories FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

-- Now we can add the FK from expenses to expense_categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.expenses'::regclass AND conname = 'expenses_expense_category_id_fkey'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_expense_category_id_fkey
      FOREIGN KEY (expense_category_id)
      REFERENCES public.expense_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Seed function: 13 BTP categories per user
CREATE OR REPLACE FUNCTION public.seed_expense_categories_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.expense_categories (user_id, slug, name, pcg_account, color, sort_order, is_default)
  VALUES
    (p_user_id, 'materiaux',         'Matériaux',                '6063', 'blue',    10, true),
    (p_user_id, 'outillage',         'Outillage',                '6068', 'sky',     20, true),
    (p_user_id, 'sous_traitance',    'Sous-traitance',           '611',  'amber',   30, true),
    (p_user_id, 'carburant',         'Carburant',                '6061', 'orange',  40, true),
    (p_user_id, 'vehicule',          'Véhicule (entretien)',     '6155', 'red',     50, true),
    (p_user_id, 'assurances',        'Assurances',               '616',  'rose',    60, true),
    (p_user_id, 'telephone',         'Téléphone / Internet',     '626',  'cyan',    70, true),
    (p_user_id, 'loyer',             'Loyer / Local',            '613',  'violet',  80, true),
    (p_user_id, 'fournitures',       'Fournitures de bureau',    '6064', 'teal',    90, true),
    (p_user_id, 'banque',            'Services bancaires',       '627',  'slate',  100, true),
    (p_user_id, 'honoraires',        'Honoraires (compta, juridique)', '6226', 'indigo', 110, true),
    (p_user_id, 'formation',         'Formation',                '6228', 'emerald', 120, true),
    (p_user_id, 'autres',            'Autres',                   '6068', 'gray',   130, true)
  ON CONFLICT (user_id, slug) DO NOTHING;
END;
$$;

-- Backfill categories for existing users (no trigger yet, see above)
DO $$
DECLARE
  u record;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_expense_categories_for_user(u.id);
  END LOOP;
END $$;

-- Now safe to install the workspace trigger
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.expense_categories
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

-- ============================================================
-- 3. accountant_access (magic-link)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.accountant_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  accountant_email text NOT NULL,
  accountant_name text DEFAULT '',
  token text UNIQUE NOT NULL,
  scope text NOT NULL DEFAULT 'full',
  scope_year int,
  scope_start date,
  scope_end date,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accountant_access_email_not_empty CHECK (char_length(trim(accountant_email)) > 0),
  CONSTRAINT accountant_access_token_length CHECK (char_length(token) >= 24),
  CONSTRAINT accountant_access_scope_check CHECK (scope IN ('full', 'fiscal_year', 'period')),
  CONSTRAINT accountant_access_scope_year_check CHECK (
    scope <> 'fiscal_year' OR scope_year IS NOT NULL
  ),
  CONSTRAINT accountant_access_period_check CHECK (
    scope <> 'period' OR (scope_start IS NOT NULL AND scope_end IS NOT NULL AND scope_end >= scope_start)
  )
);

CREATE INDEX IF NOT EXISTS idx_accountant_access_user
  ON public.accountant_access(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_accountant_access_token
  ON public.accountant_access(token)
  WHERE revoked_at IS NULL;

ALTER TABLE public.accountant_access ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.accountant_access;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.accountant_access
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS workspace_select ON public.accountant_access;
DROP POLICY IF EXISTS workspace_insert ON public.accountant_access;
DROP POLICY IF EXISTS workspace_update ON public.accountant_access;
DROP POLICY IF EXISTS workspace_delete ON public.accountant_access;

CREATE POLICY workspace_select
  ON public.accountant_access FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert
  ON public.accountant_access FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update
  ON public.accountant_access FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete
  ON public.accountant_access FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

-- ============================================================
-- 4. Storage bucket "receipts"
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS workspace_select_receipts ON storage.objects;
DROP POLICY IF EXISTS workspace_insert_receipts ON storage.objects;
DROP POLICY IF EXISTS workspace_update_receipts ON storage.objects;
DROP POLICY IF EXISTS workspace_delete_receipts ON storage.objects;

CREATE POLICY workspace_select_receipts
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_insert_receipts
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_update_receipts
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_delete_receipts
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

-- ============================================================
-- 5. business_reminder_settings: tva_method
-- ============================================================

ALTER TABLE public.business_reminder_settings
  ADD COLUMN IF NOT EXISTS tva_method text NOT NULL DEFAULT 'encaissements';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.business_reminder_settings'::regclass
      AND conname = 'business_reminder_settings_tva_method_check'
  ) THEN
    ALTER TABLE public.business_reminder_settings
      ADD CONSTRAINT business_reminder_settings_tva_method_check
      CHECK (tva_method IN ('encaissements', 'debits'));
  END IF;
END $$;

-- ============================================================
-- 6. AI plan limits: bump starter to 100k tokens (OCR is hungry)
-- ============================================================

UPDATE public.ai_plan_limits
SET monthly_tokens = 100000, monthly_calls = 30
WHERE plan = 'starter' AND monthly_tokens < 100000;

-- ============================================================
-- 7. handle_new_user(): also seed expense categories
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_email text := lower(coalesce(NEW.email, ''));
  has_pending_invite boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_memberships wm
    WHERE wm.invited_email = v_invited_email
      AND wm.member_user_id IS NULL
      AND wm.status = 'pending'
  )
  INTO has_pending_invite;

  INSERT INTO public.profiles (id, onboarding_completed)
  VALUES (NEW.id, has_pending_invite)
  ON CONFLICT (id) DO UPDATE
    SET onboarding_completed = public.profiles.onboarding_completed OR EXCLUDED.onboarding_completed;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_reminder_settings') THEN
    EXECUTE 'INSERT INTO public.business_reminder_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING' USING NEW.id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_ai_agents_for_user') THEN
    EXECUTE 'SELECT public.seed_ai_agents_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_default_lead_sources_for_user') THEN
    EXECUTE 'SELECT public.seed_default_lead_sources_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_default_lead_stages_for_user') THEN
    EXECUTE 'SELECT public.seed_default_lead_stages_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_expense_categories_for_user') THEN
    EXECUTE 'SELECT public.seed_expense_categories_for_user($1)' USING NEW.id;
  END IF;

  UPDATE public.workspace_memberships
  SET member_user_id = NEW.id,
      status = 'active',
      accepted_at = now(),
      updated_at = now()
  WHERE invited_email = v_invited_email
    AND member_user_id IS NULL
    AND status = 'pending';

  RETURN NEW;
END;
$$;
