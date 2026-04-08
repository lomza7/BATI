-- ============================================================
-- Fix: enforce_workspace_user_id() was overwriting NEW.user_id
-- unconditionally with current_workspace_user_id(), which returns
-- NULL during the signup trigger (no auth.uid() yet). This caused
-- "null value in column user_id" errors in business_reminder_settings
-- and any other table protected by set_workspace_user_id_before_write.
--
-- Fix: only overwrite when a workspace user id can actually be
-- resolved. Otherwise respect the explicit user_id provided by the
-- caller (e.g. the handle_new_user trigger passing NEW.id).
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_workspace_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_uid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_workspace_uid := public.current_workspace_user_id();
    IF v_workspace_uid IS NOT NULL THEN
      NEW.user_id := v_workspace_uid;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;
