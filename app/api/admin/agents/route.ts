import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/admin';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET: list all global agents with document counts
export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const sb = getAdminClient();

  const { data: agents } = await sb
    .from('ai_agents')
    .select('*')
    .eq('is_global', true)
    .order('display_order', { ascending: true });

  // Get document counts per agent
  const agentIds = (agents || []).map(a => a.id);
  let docCounts: Record<string, { count: number; pages: number }> = {};

  if (agentIds.length > 0) {
    const { data: docs } = await sb
      .from('agent_documents')
      .select('agent_id, page_count, file_size');

    for (const doc of docs || []) {
      if (!agentIds.includes(doc.agent_id)) continue;
      if (!docCounts[doc.agent_id]) {
        docCounts[doc.agent_id] = { count: 0, pages: 0 };
      }
      docCounts[doc.agent_id].count += 1;
      docCounts[doc.agent_id].pages += doc.page_count || 0;
    }
  }

  const result = (agents || []).map(a => ({
    ...a,
    doc_count: docCounts[a.id]?.count || 0,
    doc_pages: docCounts[a.id]?.pages || 0,
  }));

  return NextResponse.json({ agents: result });
}

// POST: create, update, delete agents or documents
export async function POST(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const sb = getAdminClient();
  const body = await request.json();

  if (body.action === 'create_agent') {
    const { name, slug, icon, description, system_prompt, display_order } = body;
    const { data, error } = await sb
      .from('ai_agents')
      .insert({
        user_id: admin.id,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name,
        icon: icon || '🤖',
        description: description || '',
        system_prompt: system_prompt || '',
        is_global: true,
        is_active: true,
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ agent: data });
  }

  if (body.action === 'update_agent') {
    const { id, ...fields } = body;
    const allowedFields = ['name', 'slug', 'icon', 'description', 'system_prompt', 'is_active', 'display_order'];
    const update: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in fields) update[key] = fields[key];
    }

    const { error } = await sb
      .from('ai_agents')
      .update(update)
      .eq('id', id)
      .eq('is_global', true);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'delete_agent') {
    const { id } = body;

    // Delete associated storage files
    const { data: docs } = await sb
      .from('agent_documents')
      .select('storage_path')
      .eq('agent_id', id);

    if (docs?.length) {
      await sb.storage
        .from('agent-documents')
        .remove(docs.map(d => d.storage_path));
    }

    const { error } = await sb
      .from('ai_agents')
      .delete()
      .eq('id', id)
      .eq('is_global', true);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'delete_document') {
    const { document_id } = body;

    const { data: doc } = await sb
      .from('agent_documents')
      .select('storage_path')
      .eq('id', document_id)
      .single();

    if (doc) {
      await sb.storage.from('agent-documents').remove([doc.storage_path]);
    }

    const { error } = await sb
      .from('agent_documents')
      .delete()
      .eq('id', document_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'get_documents') {
    const { agent_id } = body;
    const { data: docs } = await sb
      .from('agent_documents')
      .select('id, file_name, file_size, page_count, created_at')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ documents: docs || [] });
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
}
