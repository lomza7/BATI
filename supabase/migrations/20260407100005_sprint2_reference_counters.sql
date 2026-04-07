-- ============================================================
-- Migration: 20260407100005_sprint2_reference_counters
-- Description: Sprint 2 — Atomic sequential reference numbering
--   - reference_counters table (one row per user/type/year)
--   - next_reference() RPC (UPSERT + SELECT FOR UPDATE, race-safe)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create reference_counters table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reference_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counter_type text NOT NULL CHECK (counter_type IN ('quote', 'invoice', 'situation', 'credit_note')),
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, counter_type, year)
);

-- ------------------------------------------------------------
-- 2. Atomic next_reference() RPC
-- Replaces non-atomic read-then-update pattern in service layer.
-- Uses INSERT ... ON CONFLICT DO UPDATE with implicit row lock.
-- Returns: "{prefix}-{year}-{number padded to 4 digits}"
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_reference(
  p_user_id uuid,
  p_counter_type text,
  p_prefix text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year integer := extract(year from now())::integer;
  v_next integer;
BEGIN
  INSERT INTO public.reference_counters (user_id, counter_type, year, last_number)
  VALUES (p_user_id, p_counter_type, v_year, 1)
  ON CONFLICT (user_id, counter_type, year)
  DO UPDATE SET last_number = reference_counters.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN p_prefix || '-' || v_year || '-' || lpad(v_next::text, 4, '0');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.next_reference(uuid, text, text) TO authenticated;
