import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

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

  const body = await request.json().catch(() => ({}));
  const rawCode = String(body?.code ?? '').trim();
  const code = rawCode.replace(/\D/g, '');

  if (code.length !== 6) {
    return NextResponse.json({ error: 'Le code doit contenir 6 chiffres.' }, { status: 400 });
  }

  // Already verified?
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email_verified')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.email_verified) {
    return NextResponse.json({ ok: true, already_verified: true });
  }

  const { data: row } = await supabaseAdmin
    .from('email_verifications')
    .select('id, code_hash, expires_at, attempts, consumed_at')
    .eq('user_id', user.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return NextResponse.json(
      { error: 'Aucun code en attente. Demandez un nouveau code.' },
      { status: 400 }
    );
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from('email_verifications')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id);
    return NextResponse.json(
      { error: 'Ce code a expire. Demandez un nouveau code.' },
      { status: 400 }
    );
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from('email_verifications')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id);
    return NextResponse.json(
      { error: 'Trop de tentatives. Demandez un nouveau code.' },
      { status: 429 }
    );
  }

  if (hashCode(code) !== row.code_hash) {
    await supabaseAdmin
      .from('email_verifications')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id);
    return NextResponse.json({ error: 'Code incorrect.' }, { status: 400 });
  }

  // Success: mark code consumed + flip profile flag
  await supabaseAdmin
    .from('email_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id);

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ email_verified: true, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
