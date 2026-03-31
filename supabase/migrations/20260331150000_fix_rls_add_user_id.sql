/*
  # CRITICAL SECURITY FIX: Add user_id to all business tables and lock down RLS

  Problem: Most business tables used `auth.uid() IS NOT NULL`, which allowed any
  authenticated user to read and modify every other user's data.

  Fix:
    - add `user_id` to business tables that lacked tenant ownership
    - backfill ownership from relational parents whenever possible
    - fall back remaining orphan rows to the oldest auth user only as a last resort
    - rewrite RLS to `auth.uid() = user_id`
    - make AI agent seeds per-user and hook them into `handle_new_user()`
*/

-- ============================================================
-- 1. ADD user_id TO ALL AFFECTED TABLES
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE quote_lines ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE planning_events ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE team_notes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE team_assignments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- 2. BACKFILL EXISTING ROWS WITH RELATIONAL OWNERSHIP FIRST
-- ============================================================

DO $$
DECLARE
  first_user_id uuid;
  total_users integer;
BEGIN
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC, id ASC LIMIT 1;
  SELECT COUNT(*) INTO total_users FROM auth.users;

  -- Parent tables with a direct relationship to clients/projects/team members/agents.
  UPDATE quotes q
  SET user_id = c.user_id
  FROM clients c
  WHERE q.user_id IS NULL
    AND q.client_id = c.id
    AND c.user_id IS NOT NULL;

  UPDATE invoices i
  SET user_id = q.user_id
  FROM quotes q
  WHERE i.user_id IS NULL
    AND i.quote_id = q.id
    AND q.user_id IS NOT NULL;

  UPDATE invoices i
  SET user_id = c.user_id
  FROM clients c
  WHERE i.user_id IS NULL
    AND i.client_id = c.id
    AND c.user_id IS NOT NULL;

  UPDATE projects p
  SET user_id = c.user_id
  FROM clients c
  WHERE p.user_id IS NULL
    AND p.client_id = c.id
    AND c.user_id IS NOT NULL;

  UPDATE planning_events pe
  SET user_id = p.user_id
  FROM projects p
  WHERE pe.user_id IS NULL
    AND pe.project_id = p.id
    AND p.user_id IS NOT NULL;

  UPDATE planning_events pe
  SET user_id = tm.user_id
  FROM team_members tm
  WHERE pe.user_id IS NULL
    AND pe.team_member_id = tm.id
    AND tm.user_id IS NOT NULL;

  UPDATE recurring_contracts rc
  SET user_id = c.user_id
  FROM clients c
  WHERE rc.user_id IS NULL
    AND rc.client_id = c.id
    AND c.user_id IS NOT NULL;

  UPDATE reviews r
  SET user_id = p.user_id
  FROM projects p
  WHERE r.user_id IS NULL
    AND r.project_id = p.id
    AND p.user_id IS NOT NULL;

  UPDATE quote_lines ql
  SET user_id = q.user_id
  FROM quotes q
  WHERE ql.user_id IS NULL
    AND ql.quote_id = q.id
    AND q.user_id IS NOT NULL;

  UPDATE invoice_lines il
  SET user_id = i.user_id
  FROM invoices i
  WHERE il.user_id IS NULL
    AND il.invoice_id = i.id
    AND i.user_id IS NOT NULL;

  UPDATE project_photos pp
  SET user_id = p.user_id
  FROM projects p
  WHERE pp.user_id IS NULL
    AND pp.project_id = p.id
    AND p.user_id IS NOT NULL;

  UPDATE ai_conversations ac
  SET user_id = aa.user_id
  FROM ai_agents aa
  WHERE ac.user_id IS NULL
    AND ac.agent_id = aa.id
    AND aa.user_id IS NOT NULL;

  UPDATE ai_messages am
  SET user_id = ac.user_id
  FROM ai_conversations ac
  WHERE am.user_id IS NULL
    AND am.conversation_id = ac.id
    AND ac.user_id IS NOT NULL;

  UPDATE team_notes tn
  SET user_id = tm.user_id
  FROM team_members tm
  WHERE tn.user_id IS NULL
    AND tn.team_member_id = tm.id
    AND tm.user_id IS NOT NULL;

  UPDATE team_assignments ta
  SET user_id = tm.user_id
  FROM team_members tm
  WHERE ta.user_id IS NULL
    AND ta.team_member_id = tm.id
    AND tm.user_id IS NOT NULL;

  UPDATE team_assignments ta
  SET user_id = p.user_id
  FROM projects p
  WHERE ta.user_id IS NULL
    AND ta.project_id = p.id
    AND p.user_id IS NOT NULL;

  -- Last-resort fallback for orphan historical rows is only safe when the instance
  -- contains a single user. In a multi-user instance, orphan rows stay NULL and
  -- become inaccessible until they are reviewed manually.
  IF first_user_id IS NOT NULL AND total_users = 1 THEN
    UPDATE clients SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE quotes SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE quote_lines SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE invoices SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE invoice_lines SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE projects SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE project_photos SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE team_members SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE planning_events SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE leads SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE reviews SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE ai_agents SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE ai_conversations SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE ai_messages SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE recurring_contracts SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE expenses SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE team_notes SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE team_assignments SET user_id = first_user_id WHERE user_id IS NULL;
  ELSIF total_users > 1 THEN
    RAISE NOTICE 'Skipped fallback ownership assignment for orphan rows because multiple auth users exist. Review remaining NULL user_id rows manually.';
  END IF;
END $$;

-- Make new inserts safer by defaulting to the current auth user.
ALTER TABLE clients ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE quotes ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE quote_lines ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE invoices ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE invoice_lines ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE projects ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE project_photos ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE team_members ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE planning_events ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE leads ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE reviews ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE ai_agents ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE ai_conversations ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE ai_messages ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE recurring_contracts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE expenses ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE team_notes ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE team_assignments ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Tighten to NOT NULL only when the table is fully backfilled.
DO $$
DECLARE
  table_name text;
  has_nulls boolean;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'clients',
    'quotes',
    'quote_lines',
    'invoices',
    'invoice_lines',
    'projects',
    'project_photos',
    'team_members',
    'planning_events',
    'leads',
    'reviews',
    'ai_agents',
    'ai_conversations',
    'ai_messages',
    'recurring_contracts',
    'expenses',
    'team_notes',
    'team_assignments'
  ]
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE user_id IS NULL)', table_name) INTO has_nulls;
    IF NOT has_nulls THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN user_id SET NOT NULL', table_name);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 3. INDEXES FOR TENANT FILTERING
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_user_id ON quote_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_user_id ON invoice_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_photos_user_id ON project_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_events_user_id ON planning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_id ON ai_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_user_id ON recurring_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_user_id ON team_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_user_id ON team_assignments(user_id);

-- ============================================================
-- 4. DROP BROKEN POLICIES (OLD AND NEW NAMES FOR IDEMPOTENCY)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON clients;
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

DROP POLICY IF EXISTS "Authenticated users can view quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON quotes;
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;

DROP POLICY IF EXISTS "Authenticated users can view quote_lines" ON quote_lines;
DROP POLICY IF EXISTS "Authenticated users can insert quote_lines" ON quote_lines;
DROP POLICY IF EXISTS "Authenticated users can update quote_lines" ON quote_lines;
DROP POLICY IF EXISTS "Authenticated users can delete quote_lines" ON quote_lines;
DROP POLICY IF EXISTS "Users can view own quote_lines" ON quote_lines;
DROP POLICY IF EXISTS "Users can insert own quote_lines" ON quote_lines;
DROP POLICY IF EXISTS "Users can update own quote_lines" ON quote_lines;
DROP POLICY IF EXISTS "Users can delete own quote_lines" ON quote_lines;

DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete own invoices" ON invoices;

DROP POLICY IF EXISTS "Authenticated users can view invoice_lines" ON invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can insert invoice_lines" ON invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can update invoice_lines" ON invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can delete invoice_lines" ON invoice_lines;
DROP POLICY IF EXISTS "Users can view own invoice_lines" ON invoice_lines;
DROP POLICY IF EXISTS "Users can insert own invoice_lines" ON invoice_lines;
DROP POLICY IF EXISTS "Users can update own invoice_lines" ON invoice_lines;
DROP POLICY IF EXISTS "Users can delete own invoice_lines" ON invoice_lines;

DROP POLICY IF EXISTS "Authenticated users can view projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON projects;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

DROP POLICY IF EXISTS "Authenticated users can view project_photos" ON project_photos;
DROP POLICY IF EXISTS "Authenticated users can insert project_photos" ON project_photos;
DROP POLICY IF EXISTS "Authenticated users can update project_photos" ON project_photos;
DROP POLICY IF EXISTS "Authenticated users can delete project_photos" ON project_photos;
DROP POLICY IF EXISTS "Users can view own project_photos" ON project_photos;
DROP POLICY IF EXISTS "Users can insert own project_photos" ON project_photos;
DROP POLICY IF EXISTS "Users can update own project_photos" ON project_photos;
DROP POLICY IF EXISTS "Users can delete own project_photos" ON project_photos;

DROP POLICY IF EXISTS "Authenticated users can view team_members" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can insert team_members" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can update team_members" ON team_members;
DROP POLICY IF EXISTS "Authenticated users can delete team_members" ON team_members;
DROP POLICY IF EXISTS "Users can view own team_members" ON team_members;
DROP POLICY IF EXISTS "Users can insert own team_members" ON team_members;
DROP POLICY IF EXISTS "Users can update own team_members" ON team_members;
DROP POLICY IF EXISTS "Users can delete own team_members" ON team_members;

DROP POLICY IF EXISTS "Authenticated users can view planning_events" ON planning_events;
DROP POLICY IF EXISTS "Authenticated users can insert planning_events" ON planning_events;
DROP POLICY IF EXISTS "Authenticated users can update planning_events" ON planning_events;
DROP POLICY IF EXISTS "Authenticated users can delete planning_events" ON planning_events;
DROP POLICY IF EXISTS "Users can view own planning_events" ON planning_events;
DROP POLICY IF EXISTS "Users can insert own planning_events" ON planning_events;
DROP POLICY IF EXISTS "Users can update own planning_events" ON planning_events;
DROP POLICY IF EXISTS "Users can delete own planning_events" ON planning_events;

DROP POLICY IF EXISTS "Authenticated users can view leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON leads;
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON leads;

DROP POLICY IF EXISTS "Authenticated users can view reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can update reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can delete reviews" ON reviews;
DROP POLICY IF EXISTS "Users can view own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can insert own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;

DROP POLICY IF EXISTS "Authenticated users can view ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "Authenticated users can insert ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "Authenticated users can update ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "Authenticated users can delete ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "Users can view own ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "Users can insert own ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "Users can update own ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "Users can delete own ai_agents" ON ai_agents;

DROP POLICY IF EXISTS "Authenticated users can view ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Authenticated users can insert ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Authenticated users can update ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Authenticated users can delete ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can view own ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can insert own ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can update own ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can delete own ai_conversations" ON ai_conversations;

DROP POLICY IF EXISTS "Authenticated users can view ai_messages" ON ai_messages;
DROP POLICY IF EXISTS "Authenticated users can insert ai_messages" ON ai_messages;
DROP POLICY IF EXISTS "Authenticated users can update ai_messages" ON ai_messages;
DROP POLICY IF EXISTS "Authenticated users can delete ai_messages" ON ai_messages;
DROP POLICY IF EXISTS "Users can view own ai_messages" ON ai_messages;
DROP POLICY IF EXISTS "Users can insert own ai_messages" ON ai_messages;
DROP POLICY IF EXISTS "Users can update own ai_messages" ON ai_messages;
DROP POLICY IF EXISTS "Users can delete own ai_messages" ON ai_messages;

DROP POLICY IF EXISTS "Authenticated users can view recurring_contracts" ON recurring_contracts;
DROP POLICY IF EXISTS "Authenticated users can insert recurring_contracts" ON recurring_contracts;
DROP POLICY IF EXISTS "Authenticated users can update recurring_contracts" ON recurring_contracts;
DROP POLICY IF EXISTS "Authenticated users can delete recurring_contracts" ON recurring_contracts;
DROP POLICY IF EXISTS "Users can view own recurring_contracts" ON recurring_contracts;
DROP POLICY IF EXISTS "Users can insert own recurring_contracts" ON recurring_contracts;
DROP POLICY IF EXISTS "Users can update own recurring_contracts" ON recurring_contracts;
DROP POLICY IF EXISTS "Users can delete own recurring_contracts" ON recurring_contracts;

DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;

DROP POLICY IF EXISTS "Auth users can manage team notes" ON team_notes;
DROP POLICY IF EXISTS "Users can view own team_notes" ON team_notes;
DROP POLICY IF EXISTS "Users can insert own team_notes" ON team_notes;
DROP POLICY IF EXISTS "Users can update own team_notes" ON team_notes;
DROP POLICY IF EXISTS "Users can delete own team_notes" ON team_notes;

DROP POLICY IF EXISTS "Auth users can manage team assignments" ON team_assignments;
DROP POLICY IF EXISTS "Users can view own team_assignments" ON team_assignments;
DROP POLICY IF EXISTS "Users can insert own team_assignments" ON team_assignments;
DROP POLICY IF EXISTS "Users can update own team_assignments" ON team_assignments;
DROP POLICY IF EXISTS "Users can delete own team_assignments" ON team_assignments;

-- ============================================================
-- 5. RECREATE SECURE TENANT POLICIES
-- ============================================================

CREATE POLICY "Users can view own clients" ON clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON clients FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON clients FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own quotes" ON quotes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quotes" ON quotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quotes" ON quotes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own quotes" ON quotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own quote_lines" ON quote_lines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quote_lines" ON quote_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quote_lines" ON quote_lines FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own quote_lines" ON quote_lines FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoices" ON invoices FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoices" ON invoices FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own invoice_lines" ON invoice_lines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoice_lines" ON invoice_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoice_lines" ON invoice_lines FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoice_lines" ON invoice_lines FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own projects" ON projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own project_photos" ON project_photos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own project_photos" ON project_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own project_photos" ON project_photos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own project_photos" ON project_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own team_members" ON team_members FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own team_members" ON team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own team_members" ON team_members FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own team_members" ON team_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own planning_events" ON planning_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own planning_events" ON planning_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own planning_events" ON planning_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own planning_events" ON planning_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own leads" ON leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leads" ON leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leads" ON leads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own leads" ON leads FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own reviews" ON reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own ai_agents" ON ai_agents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_agents" ON ai_agents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_agents" ON ai_agents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_agents" ON ai_agents FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own ai_conversations" ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_conversations" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_conversations" ON ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_conversations" ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own ai_messages" ON ai_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_messages" ON ai_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_messages" ON ai_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_messages" ON ai_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recurring_contracts" ON recurring_contracts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring_contracts" ON recurring_contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring_contracts" ON recurring_contracts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring_contracts" ON recurring_contracts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own expenses" ON expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own team_notes" ON team_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own team_notes" ON team_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own team_notes" ON team_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own team_notes" ON team_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own team_assignments" ON team_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own team_assignments" ON team_assignments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own team_assignments" ON team_assignments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own team_assignments" ON team_assignments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 6. FIX AI AGENT SEEDING TO BE PER-USER
-- ============================================================

ALTER TABLE ai_agents DROP CONSTRAINT IF EXISTS ai_agents_slug_key;
DROP INDEX IF EXISTS idx_ai_agents_user_slug;
CREATE UNIQUE INDEX idx_ai_agents_user_slug ON ai_agents(user_id, slug);

CREATE OR REPLACE FUNCTION public.seed_ai_agents_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_agents (slug, name, description, system_prompt, user_id)
  VALUES
    ('pannes', 'Expert Pannes', 'Diagnostique les pannes courantes en plomberie, electricite, chauffage', 'Tu es un expert en diagnostic de pannes dans le batiment. Tu aides les artisans a identifier les causes probables et les solutions.', p_user_id),
    ('dtu', 'Expert DTU', 'Specialiste des Documents Techniques Unifies et normes de construction', 'Tu es un specialiste des DTU (Documents Techniques Unifies). Tu connais toutes les normes de construction francaises.', p_user_id),
    ('chiffreur', 'Chiffreur Pro', 'Aide au chiffrage precis des travaux avec prix materiaux et main-d-oeuvre', 'Tu es un expert en chiffrage de travaux. Tu aides a estimer les couts des materiaux et la main-d-oeuvre.', p_user_id),
    ('juriste', 'Juriste BTP', 'Conseils juridiques lies au BTP : contrats, assurances, litiges', 'Tu es un juriste specialise dans le droit du BTP. Tu conseilles sur les contrats, assurances et litiges.', p_user_id),
    ('rge_cee', 'Expert RGE/CEE', 'Aide sur les certifications RGE et les Certificats d-Economies d-Energie', 'Tu es un expert en certifications RGE et CEE. Tu aides les artisans a comprendre les demarches et les aides.', p_user_id)
  ON CONFLICT (user_id, slug) DO NOTHING;
END;
$$;

INSERT INTO public.ai_agents (slug, name, description, system_prompt, user_id)
SELECT seed.slug, seed.name, seed.description, seed.system_prompt, u.id
FROM auth.users u
CROSS JOIN (
  VALUES
    ('pannes', 'Expert Pannes', 'Diagnostique les pannes courantes en plomberie, electricite, chauffage', 'Tu es un expert en diagnostic de pannes dans le batiment. Tu aides les artisans a identifier les causes probables et les solutions.'),
    ('dtu', 'Expert DTU', 'Specialiste des Documents Techniques Unifies et normes de construction', 'Tu es un specialiste des DTU (Documents Techniques Unifies). Tu connais toutes les normes de construction francaises.'),
    ('chiffreur', 'Chiffreur Pro', 'Aide au chiffrage precis des travaux avec prix materiaux et main-d-oeuvre', 'Tu es un expert en chiffrage de travaux. Tu aides a estimer les couts des materiaux et la main-d-oeuvre.'),
    ('juriste', 'Juriste BTP', 'Conseils juridiques lies au BTP : contrats, assurances, litiges', 'Tu es un juriste specialise dans le droit du BTP. Tu conseilles sur les contrats, assurances et litiges.'),
    ('rge_cee', 'Expert RGE/CEE', 'Aide sur les certifications RGE et les Certificats d-Economies d-Energie', 'Tu es un expert en certifications RGE et CEE. Tu aides les artisans a comprendre les demarches et les aides.')
) AS seed(slug, name, description, system_prompt)
ON CONFLICT (user_id, slug) DO NOTHING;

-- Keep profiles aligned and seed agents for future signups too.
INSERT INTO public.profiles (id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  PERFORM public.seed_ai_agents_for_user(NEW.id);
  RETURN NEW;
END;
$$;
