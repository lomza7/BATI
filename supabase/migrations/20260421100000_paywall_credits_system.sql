-- Paywall Hellobat: Free + Pro + Crédits IA + Trial 30j
-- Phase 1: schéma (colonnes profils, tables usage_counters + credit_transactions, fonctions)

-- ──────────────────────────────────────────────────────────────
-- Colonnes profils
-- ──────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_end_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trialing';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_credits_balance integer NOT NULL DEFAULT 0;

-- ──────────────────────────────────────────────────────────────
-- usage_counters: compteurs d'usage mensuels (devis/factures/IA)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,  -- format 'YYYY-MM'
  feature text NOT NULL, -- quote, invoice, quote_ai, agent, email_ai, accounting_ai, before_after, site_web
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period, feature)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_user_period
  ON usage_counters(user_id, period);

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_counters_self_read" ON usage_counters;
CREATE POLICY "usage_counters_self_read"
  ON usage_counters FOR SELECT
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- credit_transactions: audit trail des mouvements de crédits IA
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('purchase','usage','adjustment','trial_bonus')),
  feature text,
  stripe_session_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user
  ON credit_transactions(user_id, created_at DESC);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_tx_self_read" ON credit_transactions;
CREATE POLICY "credit_tx_self_read"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- Migration plans existants: starter → free, business → pro
-- ──────────────────────────────────────────────────────────────
UPDATE profiles SET plan = 'free' WHERE plan = 'starter';
UPDATE profiles SET plan = 'pro'  WHERE plan = 'business';

-- Backfill trial pour tous les users existants (30j à partir de maintenant)
-- Les users avec Stripe sub active restent en 'active', les autres démarrent en 'trialing'.
UPDATE profiles
SET trial_end_at = now() + interval '30 days',
    subscription_status = CASE
      WHEN stripe_customer_id IS NOT NULL AND plan = 'pro' THEN 'active'
      ELSE 'trialing'
    END
WHERE trial_end_at IS NULL;

-- ──────────────────────────────────────────────────────────────
-- Trigger: tout nouveau profil démarre en trial Pro 30 jours
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_trial_on_profile_create()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trial_end_at IS NULL THEN
    NEW.trial_end_at := now() + interval '30 days';
  END IF;
  IF NEW.subscription_status IS NULL OR NEW.subscription_status = 'trialing' THEN
    NEW.subscription_status := 'trialing';
  END IF;
  IF NEW.plan IS NULL OR NEW.plan = 'starter' OR NEW.plan = 'free' THEN
    NEW.plan := 'pro';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_trial ON profiles;
CREATE TRIGGER profiles_set_trial
BEFORE INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION set_trial_on_profile_create();

-- ──────────────────────────────────────────────────────────────
-- Drop table obsolète (remplacée par consume_ai + platform_config)
-- ──────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS ai_plan_limits;

-- ──────────────────────────────────────────────────────────────
-- Helper: has_pro_access(user_id)
-- Pro actif = plan='pro' ET (status='active' OR (status='trialing' AND trial_end_at > now()))
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION has_pro_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_user_id
      AND p.plan = 'pro'
      AND (
        p.subscription_status = 'active'
        OR (p.subscription_status = 'trialing' AND p.trial_end_at > now())
      )
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- Helper: can_create_quote_or_invoice(user_id, 'quote'|'invoice')
-- Pro → OK. Free → max 5/mois.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_create_quote_or_invoice(p_user_id uuid, p_feature text)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT has_pro_access(p_user_id)
      OR COALESCE(
           (SELECT count FROM usage_counters
             WHERE user_id = p_user_id
               AND period = to_char(now(),'YYYY-MM')
               AND feature = p_feature),
           0
         ) < 5;
$$;

-- ──────────────────────────────────────────────────────────────
-- consume_ai: fonction atomique de consommation IA
-- Vérifie Pro → quota mensuel → crédits → débite le bon canal.
-- Retourne un JSON { ok, source|reason, balance?, required? }.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION consume_ai(
  p_user_id uuid,
  p_feature text,
  p_quota integer,
  p_credit_cost integer
)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_current_count int;
  v_balance int;
  v_period text := to_char(now(), 'YYYY-MM');
BEGIN
  IF NOT has_pro_access(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pro_access');
  END IF;

  SELECT COALESCE(count, 0) INTO v_current_count
    FROM usage_counters
    WHERE user_id = p_user_id AND period = v_period AND feature = p_feature;

  -- Canal 1: quota mensuel
  IF v_current_count < p_quota THEN
    INSERT INTO usage_counters (user_id, period, feature, count)
    VALUES (p_user_id, v_period, p_feature, 1)
    ON CONFLICT (user_id, period, feature)
    DO UPDATE SET count = usage_counters.count + 1, updated_at = now();

    RETURN jsonb_build_object('ok', true, 'source', 'quota');
  END IF;

  -- Canal 2: crédits (lock la row profils pour éviter double-débit)
  SELECT ai_credits_balance INTO v_balance
    FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF COALESCE(v_balance, 0) < p_credit_cost THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_credits',
      'balance', COALESCE(v_balance, 0),
      'required', p_credit_cost
    );
  END IF;

  UPDATE profiles
    SET ai_credits_balance = ai_credits_balance - p_credit_cost
    WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, delta, kind, feature)
    VALUES (p_user_id, -p_credit_cost, 'usage', p_feature);

  -- On bump aussi le compteur mensuel pour que le widget affiche l'usage réel
  INSERT INTO usage_counters (user_id, period, feature, count)
  VALUES (p_user_id, v_period, p_feature, 1)
  ON CONFLICT (user_id, period, feature)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'source', 'credits',
    'consumed', p_credit_cost,
    'balance', v_balance - p_credit_cost
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
