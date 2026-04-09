import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'louis@maaza.pro';

// Keys safe to expose to admin client (we mask the value if too long)
const ALLOWED_KEYS = new Set([
  'image_provider',
  'openai_api_key',
  'openai_image_model',
  'gemini_api_key',
  'gemini_image_model',
  'groq_api_key',
]);

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const sb = getAdminClient();
  const { data, error } = await sb
    .from('platform_secrets')
    .select('key, value, label, updated_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return values as-is to admin (only admin can hit this endpoint)
  const secrets: Record<string, { value: string; label: string; updated_at: string }> = {};
  for (const row of data || []) {
    secrets[row.key] = {
      value: row.value || '',
      label: row.label || '',
      updated_at: row.updated_at,
    };
  }

  return NextResponse.json({ secrets });
}

export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { updates?: Record<string, string> } | null;
  if (!body?.updates || typeof body.updates !== 'object') {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 });
  }

  const sb = getAdminClient();
  const errors: Array<{ key: string; error: string }> = [];

  for (const [key, value] of Object.entries(body.updates)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value !== 'string') continue;

    const { error } = await sb
      .from('platform_secrets')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) errors.push({ key, error: error.message });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Erreur(s) lors de la sauvegarde', details: errors }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
