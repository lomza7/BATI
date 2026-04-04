-- ============================================================
-- Admin-managed AI agents with PDF knowledge base
-- ============================================================

-- 1. New columns on ai_agents for global/admin agents
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS icon text DEFAULT '🤖';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS display_order int DEFAULT 0;

-- 2. Agent documents table (PDF knowledge base)
CREATE TABLE IF NOT EXISTS agent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_size int DEFAULT 0,
  storage_path text NOT NULL,
  extracted_text text DEFAULT '',
  page_count int DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_accessible_docs" ON agent_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_agents WHERE id = agent_documents.agent_id
      AND (user_id = auth.uid() OR is_global = true)
  ));

-- 3. Update ai_agents RLS: allow SELECT on global agents
DROP POLICY IF EXISTS "Users can view own ai_agents" ON ai_agents;
CREATE POLICY "view_own_or_global_agents" ON ai_agents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_global = true);

-- 4. Storage bucket for agent PDFs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-documents', 'agent-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_read_agent_docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agent-documents');
