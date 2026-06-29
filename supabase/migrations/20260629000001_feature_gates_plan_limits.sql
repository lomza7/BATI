-- Add subscription tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS trial_end_at timestamptz DEFAULT NULL;

-- Update ai_plan_limits to match new tier values and add free tier
INSERT INTO ai_plan_limits (plan, monthly_calls, monthly_tokens) VALUES
  ('free',     0,   0),
  ('starter',  0,   0),
  ('pro',      50,  100000),
  ('business', -1,  -1)
ON CONFLICT (plan) DO UPDATE
  SET monthly_calls  = EXCLUDED.monthly_calls,
      monthly_tokens = EXCLUDED.monthly_tokens;

-- Ensure RLS is enabled and authenticated users can read plan limits
ALTER TABLE ai_plan_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_plan_limits' AND policyname = 'authenticated_read_plan_limits'
  ) THEN
    CREATE POLICY "authenticated_read_plan_limits" ON ai_plan_limits
      FOR SELECT TO authenticated USING (true);
  END IF;
END
$$;
