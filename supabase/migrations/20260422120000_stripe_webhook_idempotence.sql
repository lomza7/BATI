-- Phase 5 — Idempotence des webhooks Stripe.
-- stripe_webhook_events est une "log table" : on insert event.id en tête de
-- chaque webhook, et si l'INSERT viole la contrainte primaire, on skippe
-- le traitement (rejeu Stripe déjà vu).
-- Par ailleurs, on ajoute un UNIQUE index sur credit_transactions.stripe_session_id
-- pour que le crédit d'un pack soit idempotent au niveau DB (en plus de la
-- vérification code dans creditPackPurchase).

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Pas de policy: table accessible uniquement par service_role (supabaseAdmin).

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_stripe_session_idx
  ON credit_transactions (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
