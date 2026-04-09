-- ============================================================
-- Demo clear v2: promote demo entities that have real children
--
-- Problem: if a user creates real work on top of the demo
-- (e.g. a real project linked to a demo client), calling
-- clear_demo_data_for_user fails with a FK violation because
-- projects.client_id has ON DELETE NO ACTION.
--
-- Fix: before deleting, promote (set is_demo = false) any demo
-- client/project/quote/team_member that is referenced by at
-- least one non-demo row. Run the promotion in multiple passes
-- so chains resolve (non-demo invoice -> promote quote ->
-- promote client).
-- ============================================================

CREATE OR REPLACE FUNCTION public.clear_demo_data_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int;
BEGIN
  -- STEP 1: promote demo entities that have real children.
  -- 3 passes is enough to resolve any chain in the current schema.
  FOR i IN 1..3 LOOP
    -- Promote demo team_members referenced by a non-demo planning_event
    UPDATE public.team_members tm
    SET is_demo = false
    WHERE tm.user_id = p_user_id
      AND tm.is_demo = true
      AND EXISTS (
        SELECT 1 FROM public.planning_events pe
        WHERE pe.team_member_id = tm.id AND pe.is_demo = false
      );

    -- Promote demo quotes referenced by a non-demo invoice / recurring_contract / project
    UPDATE public.quotes q
    SET is_demo = false
    WHERE q.user_id = p_user_id
      AND q.is_demo = true
      AND (
        EXISTS (SELECT 1 FROM public.invoices i WHERE i.quote_id = q.id AND i.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.recurring_contracts rc WHERE rc.quote_id = q.id)
        OR EXISTS (SELECT 1 FROM public.projects p WHERE p.quote_id = q.id AND p.is_demo = false)
      );

    -- Promote demo projects referenced by a non-demo quote / invoice / review / planning_event / expense
    UPDATE public.projects p
    SET is_demo = false
    WHERE p.user_id = p_user_id
      AND p.is_demo = true
      AND (
        EXISTS (SELECT 1 FROM public.quotes q WHERE q.project_id = p.id AND q.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.project_id = p.id AND i.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.reviews r WHERE r.project_id = p.id)
        OR EXISTS (SELECT 1 FROM public.planning_events pe WHERE pe.project_id = p.id AND pe.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.expenses e WHERE e.project_id = p.id AND e.is_demo = false)
      );

    -- Promote demo clients referenced by a non-demo project / quote / invoice / recurring_contract
    UPDATE public.clients c
    SET is_demo = false
    WHERE c.user_id = p_user_id
      AND c.is_demo = true
      AND (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.client_id = c.id AND p.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.quotes q WHERE q.client_id = c.id AND q.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.client_id = c.id AND i.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.recurring_contracts rc WHERE rc.client_id = c.id)
      );
  END LOOP;

  -- STEP 2: delete all remaining demo data in dependency order.
  DELETE FROM public.planning_events  WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.calendar_events  WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.todos            WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.expenses         WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.invoice_lines    WHERE is_demo = true AND invoice_id IN (SELECT id FROM public.invoices WHERE user_id = p_user_id AND is_demo = true);
  DELETE FROM public.invoices         WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.quote_lines      WHERE is_demo = true AND quote_id IN (SELECT id FROM public.quotes WHERE user_id = p_user_id AND is_demo = true);
  DELETE FROM public.quotes           WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.document_files   WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.document_folders WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.projects         WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.services         WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.team_members     WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.clients          WHERE user_id = p_user_id AND is_demo = true;

  -- STEP 3: close the demo banner so it never reappears.
  UPDATE public.profiles
  SET demo_active = false,
      demo_intro_seen = true
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_demo_data_for_user(uuid) TO service_role;
