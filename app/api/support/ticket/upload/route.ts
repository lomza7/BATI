import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const BUCKET = 'support-attachments';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set<string>([
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/heic',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/webm',
  'text/plain',
]);

function safeFilename(name: string): string {
  // Enlève tout ce qui n'est pas ASCII alphanumeric / . / _ / -.
  // Évite les injections et les caractères problématiques en storage.
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return base || 'file';
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const token = authHeader.slice(7).trim();

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Rate-limit : 30 uploads / heure / user suffit largement.
  const rl = checkRateLimit(`support-upload:user:${user.id}`, 30, 60 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Corps invalide (multipart attendu)' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Champ `file` manquant' }, { status: 400 });
  }
  const originalName = (file as File).name || 'file';

  if (file.size === 0) {
    return NextResponse.json({ error: 'Fichier vide' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Type de fichier non autorisé (${file.type || 'inconnu'})` }, { status: 415 });
  }

  // Path : <user_id>/<timestamp>-<filename>. Le ticket_id n'existe pas
  // encore au moment de l'upload (upload-then-submit), donc on scope par
  // user + timestamp pour éviter les collisions.
  const filename = safeFilename(originalName);
  const key = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(key, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    console.error('[support/upload] storage error', uploadErr);
    return NextResponse.json({ error: 'Upload échoué' }, { status: 500 });
  }

  return NextResponse.json({
    path: key,
    name: filename,
    mime: file.type,
    size: file.size,
  });
}
