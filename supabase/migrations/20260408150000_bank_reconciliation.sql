-- ============================================================
-- Rapprochement bancaire
-- 1. Table bank_statements (un import = un fichier)
-- 2. Table bank_transactions (chaque ligne du relevé)
-- 3. Colonnes de pointage sur expenses + invoices
-- 4. Bucket storage privé "bank-statements" (RLS workspace)
-- ============================================================

-- ============================================================
-- 1. bank_statements
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  filename text NOT NULL,
  format text NOT NULL,
  bank_name text DEFAULT '',
  account_iban text DEFAULT '',
  period_start date,
  period_end date,
  opening_balance numeric(12,2),
  closing_balance numeric(12,2),
  transaction_count int NOT NULL DEFAULT 0,
  storage_path text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_statements_format_check CHECK (format IN ('csv', 'ofx'))
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_user_imported
  ON public.bank_statements(user_id, imported_at DESC);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.bank_statements;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.bank_statements
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS workspace_select ON public.bank_statements;
DROP POLICY IF EXISTS workspace_insert ON public.bank_statements;
DROP POLICY IF EXISTS workspace_update ON public.bank_statements;
DROP POLICY IF EXISTS workspace_delete ON public.bank_statements;

CREATE POLICY workspace_select
  ON public.bank_statements FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert
  ON public.bank_statements FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update
  ON public.bank_statements FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete
  ON public.bank_statements FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

-- ============================================================
-- 2. bank_transactions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  statement_id uuid REFERENCES public.bank_statements(id) ON DELETE CASCADE NOT NULL,
  transaction_date date NOT NULL,
  value_date date,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL,
  direction text NOT NULL,
  fitid text,
  -- Rapprochement
  matched_at timestamptz,
  matched_kind text,
  matched_expense_id uuid,
  matched_invoice_id uuid,
  match_confidence numeric(3,2),
  match_method text,
  ignored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_transactions_direction_check CHECK (direction IN ('credit', 'debit')),
  CONSTRAINT bank_transactions_matched_kind_check CHECK (
    matched_kind IS NULL OR matched_kind IN ('expense', 'invoice')
  ),
  CONSTRAINT bank_transactions_match_method_check CHECK (
    match_method IS NULL OR match_method IN ('auto', 'ai', 'manual')
  )
);

-- Foreign keys to expenses/invoices added after table creation to avoid circular dep
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bank_transactions'::regclass
      AND conname = 'bank_transactions_matched_expense_id_fkey'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD CONSTRAINT bank_transactions_matched_expense_id_fkey
      FOREIGN KEY (matched_expense_id) REFERENCES public.expenses(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bank_transactions'::regclass
      AND conname = 'bank_transactions_matched_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD CONSTRAINT bank_transactions_matched_invoice_id_fkey
      FOREIGN KEY (matched_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Idempotence sur fitid (seulement si non null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_user_fitid
  ON public.bank_transactions(user_id, fitid)
  WHERE fitid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_date
  ON public.bank_transactions(user_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_unmatched
  ON public.bank_transactions(user_id)
  WHERE matched_at IS NULL AND ignored = false;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_statement
  ON public.bank_transactions(statement_id);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.bank_transactions;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.bank_transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

DROP POLICY IF EXISTS workspace_select ON public.bank_transactions;
DROP POLICY IF EXISTS workspace_insert ON public.bank_transactions;
DROP POLICY IF EXISTS workspace_update ON public.bank_transactions;
DROP POLICY IF EXISTS workspace_delete ON public.bank_transactions;

CREATE POLICY workspace_select
  ON public.bank_transactions FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert
  ON public.bank_transactions FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update
  ON public.bank_transactions FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete
  ON public.bank_transactions FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

-- ============================================================
-- 3. Pointage côté expenses/invoices (lien réciproque)
-- ============================================================

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS bank_transaction_id uuid;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bank_transaction_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.expenses'::regclass
      AND conname = 'expenses_bank_transaction_id_fkey'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_bank_transaction_id_fkey
      FOREIGN KEY (bank_transaction_id) REFERENCES public.bank_transactions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_bank_transaction_id_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_bank_transaction_id_fkey
      FOREIGN KEY (bank_transaction_id) REFERENCES public.bank_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_bank_transaction
  ON public.expenses(bank_transaction_id) WHERE bank_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_bank_transaction
  ON public.invoices(bank_transaction_id) WHERE bank_transaction_id IS NOT NULL;

-- ============================================================
-- 4. Storage bucket "bank-statements" (privé, RLS workspace)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS workspace_select_bank_statements ON storage.objects;
DROP POLICY IF EXISTS workspace_insert_bank_statements ON storage.objects;
DROP POLICY IF EXISTS workspace_update_bank_statements ON storage.objects;
DROP POLICY IF EXISTS workspace_delete_bank_statements ON storage.objects;

CREATE POLICY workspace_select_bank_statements
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bank-statements'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_insert_bank_statements
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bank-statements'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_update_bank_statements
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bank-statements'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  )
  WITH CHECK (
    bucket_id = 'bank-statements'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );

CREATE POLICY workspace_delete_bank_statements
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bank-statements'
    AND (storage.foldername(name))[1] = public.current_workspace_user_id()::text
  );
