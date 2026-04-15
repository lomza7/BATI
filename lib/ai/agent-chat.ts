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

/**
 * Résumé compact des données de l'artisan (clients + chantiers + tâches)
 * injecté dans le system prompt pour que l'agent puisse répondre en
 * s'appuyant sur le CRM / la réalité du terrain. Volume limité pour
 * contrôler le coût OpenAI (~2-3k tokens max).
 */
export async function buildUserDataContext(userId: string): Promise<string> {
  const sb = getAdminClient();

  const [clientsRes, projectsRes, todosRes] = await Promise.all([
    sb
      .from('clients')
      .select('name, email, phone, city, contact_type')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('projects')
      .select('name, status, city, budget, start_date, end_date, clients(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('todos')
      .select('title, priority, category, due_date, completed')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50),
  ]);

  const clients = clientsRes.data || [];
  const projects = projectsRes.data || [];
  const todos = todosRes.data || [];

  if (clients.length === 0 && projects.length === 0 && todos.length === 0) {
    return '';
  }

  const clientsBlock = clients.length
    ? clients
        .map(
          (c) =>
            `- ${c.name}${c.contact_type && c.contact_type !== 'client' ? ` [${c.contact_type}]` : ''}${c.city ? ` — ${c.city}` : ''}${c.email ? ` — ${c.email}` : ''}${c.phone ? ` — ${c.phone}` : ''}`,
        )
        .join('\n')
    : '(aucun)';

  const projectsBlock = projects.length
    ? projects
        .map((p) => {
          const client = (p as { clients?: { name?: string } | null }).clients?.name || 'sans client';
          const budget = p.budget ? ` — budget ${Number(p.budget).toLocaleString('fr-FR')} €` : '';
          const dates = p.start_date
            ? ` — début ${p.start_date}${p.end_date ? ` → ${p.end_date}` : ''}`
            : '';
          return `- ${p.name} [${p.status}] — ${client}${p.city ? ` — ${p.city}` : ''}${budget}${dates}`;
        })
        .join('\n')
    : '(aucun)';

  const pendingTodos = todos.filter((t) => !t.completed);
  const todosBlock = pendingTodos.length
    ? pendingTodos
        .map(
          (t) =>
            `- ${t.title} [${t.priority}/${t.category}]${t.due_date ? ` — échéance ${t.due_date}` : ''}`,
        )
        .join('\n')
    : '(aucune)';

  return [
    `\n\n--- Données de l'artisan ---`,
    `Clients (${clients.length}) :\n${clientsBlock}`,
    `\nChantiers (${projects.length}) :\n${projectsBlock}`,
    `\nTâches en cours (${pendingTodos.length}) :\n${todosBlock}`,
  ].join('\n');
}
