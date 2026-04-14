-- Phase 7 — Expiration automatique des trials.
-- À J+30 sans CB, un user trial bascule en plan=free/status=free.
-- Exécuté toutes les heures via pg_cron.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop si déjà planifié
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expire-trials-hourly';

SELECT cron.schedule(
  'expire-trials-hourly',
  '0 * * * *',
  $$
    UPDATE profiles
    SET subscription_status = 'free',
        plan = 'free'
    WHERE subscription_status = 'trialing'
      AND trial_end_at IS NOT NULL
      AND trial_end_at < now()
      AND stripe_subscription_id IS NULL;
  $$
);
