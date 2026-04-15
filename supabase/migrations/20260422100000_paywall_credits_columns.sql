-- Phase 1 — Colonnes paywall lues par lib/subscription.ts / /api/me/access.
-- Minimal: ajoute les colonnes manquantes avec defaults sûrs pour débloquer
-- la lecture. La logique de pool réel reste portée par usage_counters +
-- ai_credits_balance (voir 20260421100000_paywall_credits_system.sql).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_credits_allocation int NOT NULL DEFAULT 300;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_credits_used int NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_period_start timestamptz;

UPDATE profiles
SET credits_period_start = date_trunc('month', COALESCE(created_at, now()))
WHERE credits_period_start IS NULL;

NOTIFY pgrst, 'reload schema';
