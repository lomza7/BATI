import { createClient } from '@supabase/supabase-js';

const MAX_CONTEXT_CHARS = 300_000; // ~75k tokens

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function buildAgentContext(agentId: string): Promise<{
  systemPrompt: string;
  documentContext: string;
}> {
  const sb = getAdminClient();

  const { data: agent } = await sb
    .from('ai_agents')
    .select('system_prompt')
    .eq('id', agentId)
    .single();

  if (!agent) throw new Error('Agent introuvable');

  const { data: docs } = await sb
    .from('agent_documents')
    .select('file_name, extracted_text')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true });

  let documentContext = '';
  if (docs?.length) {
    const parts: string[] = [];
    let totalLen = 0;

    for (const doc of docs) {
      if (!doc.extracted_text) continue;
      const section = `\n\n--- Document : ${doc.file_name} ---\n${doc.extracted_text}`;
      if (totalLen + section.length > MAX_CONTEXT_CHARS) {
        const remaining = MAX_CONTEXT_CHARS - totalLen;
        if (remaining > 200) {
          parts.push(section.slice(0, remaining) + '\n[...document tronque]');
        }
        break;
      }
      parts.push(section);
      totalLen += section.length;
    }

    documentContext = parts.join('');
  }

  return {
    systemPrompt: agent.system_prompt || '',
    documentContext,
  };
}
