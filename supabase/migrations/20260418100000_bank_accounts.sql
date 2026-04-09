-- ============================================================
-- RIB / coordonnees bancaires de l'artisan
--
-- Un artisan peut enregistrer plusieurs comptes bancaires et en designer
-- un par defaut. Chaque devis / facture peut referencer un compte via
-- `bank_account_id` (nullable). Les comptes sont soft-deleted pour que
-- les devis / factures historiques gardent leurs coordonnees meme si
-- l'artisan supprime le compte plus tard.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT public.current_workspace_user_id(),
  label text NOT NULL,
  bank_name text NOT NULL,
  bank_slug text,
  account_holder text NOT NULL,
  iban text NOT NULL,
  bic text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT bank_accounts_label_not_empty CHECK (char_length(trim(label)) > 0),
  CONSTRAINT bank_accounts_bank_name_not_empty CHECK (char_length(trim(bank_name)) > 0),
  CONSTRAINT bank_accounts_holder_not_empty CHECK (char_length(trim(account_holder)) > 0),
  CONSTRAINT bank_accounts_iban_format CHECK (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  CONSTRAINT bank_accounts_bic_format CHECK (bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$')
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user
  ON public.bank_accounts(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Un seul RIB par defaut par utilisateur (parmi ceux non supprimes).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_accounts_default_per_user
  ON public.bank_accounts(user_id)
  WHERE is_default = true AND deleted_at IS NULL;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_workspace_user_id_before_write ON public.bank_accounts;
CREATE TRIGGER set_workspace_user_id_before_write
BEFORE INSERT OR UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_user_id();

-- updated_at auto
CREATE OR REPLACE FUNCTION public.touch_bank_accounts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bank_accounts_touch_updated_at ON public.bank_accounts;
CREATE TRIGGER bank_accounts_touch_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_bank_accounts_updated_at();

DROP POLICY IF EXISTS workspace_select ON public.bank_accounts;
DROP POLICY IF EXISTS workspace_insert ON public.bank_accounts;
DROP POLICY IF EXISTS workspace_update ON public.bank_accounts;
DROP POLICY IF EXISTS workspace_delete ON public.bank_accounts;

CREATE POLICY workspace_select
  ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.has_workspace_access(user_id));

CREATE POLICY workspace_insert
  ON public.bank_accounts FOR INSERT TO authenticated
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_update
  ON public.bank_accounts FOR UPDATE TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.current_workspace_user_id() = user_id);

CREATE POLICY workspace_delete
  ON public.bank_accounts FOR DELETE TO authenticated
  USING (public.has_workspace_access(user_id));

-- ============================================================
-- Liaison vers les devis et factures.
-- ON DELETE SET NULL — la suppression du RIB ne casse pas le document,
-- mais le soft-delete est la voie recommandee pour preserver l'historique.
-- ============================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS bank_account_id uuid
  REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bank_account_id uuid
  REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_bank_account ON public.quotes(bank_account_id) WHERE bank_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_bank_account ON public.invoices(bank_account_id) WHERE bank_account_id IS NOT NULL;
