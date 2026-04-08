import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const SHARED_SOURCE_PATH = '_demo/bienvenue-hellobat.pdf';
const FILE_NAME = 'Bienvenue sur Hellobat.pdf';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Session utilisateur requise' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 503 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
  }

  // Find the user's demo "Bienvenue" folder (seeded by seed_demo_data_for_user)
  const { data: folder } = await supabaseAdmin
    .from('document_folders')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_demo', true)
    .eq('name', 'Bienvenue')
    .is('parent_id', null)
    .maybeSingle();

  if (!folder) {
    return NextResponse.json({ ok: true, skipped: 'no_demo_folder' });
  }

  // If we already created the file row, nothing to do
  const { data: existing } = await supabaseAdmin
    .from('document_files')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_demo', true)
    .eq('folder_id', folder.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: 'already_bootstrapped' });
  }

  // 1. Download shared PDF via service role
  const { data: sourceBlob, error: downloadError } = await supabaseAdmin.storage
    .from('documents')
    .download(SHARED_SOURCE_PATH);

  if (downloadError || !sourceBlob) {
    return NextResponse.json({ error: 'Fichier de bienvenue introuvable' }, { status: 500 });
  }

  // 2. Upload a copy into the user's own folder
  const destPath = `${user.id}/${folder.id}/${Date.now()}-bienvenue-hellobat.pdf`;
  const buffer = Buffer.from(await sourceBlob.arrayBuffer());
  const sizeBytes = buffer.byteLength;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(destPath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Impossible de copier le fichier de demo' }, { status: 500 });
  }

  // 3. Insert document_files row
  const { error: insertError } = await supabaseAdmin
    .from('document_files')
    .insert({
      user_id: user.id,
      folder_id: folder.id,
      project_id: null,
      storage_bucket: 'documents',
      visibility: 'private',
      name: FILE_NAME,
      original_name: FILE_NAME,
      mime_type: 'application/pdf',
      size_bytes: sizeBytes,
      storage_path: destPath,
      is_demo: true,
    });

  if (insertError) {
    await supabaseAdmin.storage.from('documents').remove([destPath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bootstrapped: true });
}
