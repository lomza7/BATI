-- Enable RLS on ai_plan_limits.
-- Pas de données sensibles (juste les seuils par plan), mais on garde la cohérence
-- de RLS partout pour eviter les faux positifs des advisors Supabase.
-- Migration idempotente : safe à rejouer.

ALTER TABLE ai_plan_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_plan_limits_select" ON ai_plan_limits;

CREATE POLICY "ai_plan_limits_select" ON ai_plan_limits
  FOR SELECT TO authenticated
  USING (true);
