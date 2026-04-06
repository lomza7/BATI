-- Atomic reference counter RPC to prevent race conditions
-- Replaces the read-then-update pattern in service.ts which was non-atomic

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
  INSERT INTO reference_counters (user_id, counter_type, year, last_number)
  VALUES (p_user_id, p_counter_type, v_year, 1)
  ON CONFLICT (user_id, counter_type, year)
  DO UPDATE SET last_number = reference_counters.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN p_prefix || '-' || v_year || '-' || lpad(v_next::text, 3, '0');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.next_reference(uuid, text, text) TO authenticated;
