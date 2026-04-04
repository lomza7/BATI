-- Track every AI API call per user
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  route text NOT NULL,              -- e.g. 'ai/quote', 'ai/site-content'
  model text,
  input_tokens int DEFAULT 0,
  output_tokens int DEFAULT 0,
  total_tokens int GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  status text DEFAULT 'success',    -- success | error
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "user_read_own_usage" ON ai_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_ai_usage_user_created ON ai_usage(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_user_month ON ai_usage(user_id, created_at)
  WHERE status = 'success';

-- AI usage limits per plan (configurable)
CREATE TABLE IF NOT EXISTS ai_plan_limits (
  plan text PRIMARY KEY,            -- starter | pro | business
  monthly_calls int NOT NULL,       -- max calls per month, -1 = unlimited
  monthly_tokens int NOT NULL       -- max tokens per month, -1 = unlimited
);

INSERT INTO ai_plan_limits (plan, monthly_calls, monthly_tokens) VALUES
  ('starter', 10, 50000),
  ('pro', 100, 500000),
  ('business', -1, -1)
ON CONFLICT (plan) DO NOTHING;

-- Manual user blocks
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_blocked boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_blocked_reason text DEFAULT '';
