import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractPdfText } from '@/lib/ai/pdf-extract';
import { verifyAdminRequest } from '@/lib/admin';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const formData = await request.formData();
  const agentId = formData.get('agent_id') as string;
  const file = formData.get('file') as File | null;

  if (!agentId || !file) {
    return NextResponse.json({ error: 'agent_id et file requis' }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Seuls les fichiers PDF sont acceptes' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 50 Mo)' }, { status: 400 });
  }

  const sb = getAdminClient();

  // Verify agent exists and is global
  const { data: agent } = await sb
    .from('ai_agents')
    .select('id')
    .eq('id', agentId)
    .eq('is_global', true)
    .single();

  if (!agent) {
    return NextResponse.json({ error: 'Agent introuvable' }, { status: 404 });
  }

  // Extract text from PDF
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let text = '';
  let pageCount = 0;
  try {
    const result = await extractPdfText(buffer);
    text = result.text;
    pageCount = result.pageCount;
  } catch (err) {
    return NextResponse.json(
      { error: `Impossible de lire le PDF : ${err instanceof Error ? err.message : 'erreur'}` },
      { status: 422 },
    );
  }

  // Upload to storage
  const storagePath = `agents/${agentId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: uploadError } = await sb.storage
    .from('agent-documents')
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Erreur upload : ${uploadError.message}` }, { status: 500 });
  }

  // Insert document record
  const { data: doc, error: insertError } = await sb
    .from('agent_documents')
    .insert({
      agent_id: agentId,
      file_name: file.name,
      file_size: file.size,
      storage_path: storagePath,
      extracted_text: text,
      page_count: pageCount,
      uploaded_by: admin.id,
    })
    .select('id, file_name, file_size, page_count, created_at')
    .single();

  if (insertError) {
    // Clean up storage on DB failure
    await sb.storage.from('agent-documents').remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    document: doc,
    extracted_chars: text.length,
  });
}
