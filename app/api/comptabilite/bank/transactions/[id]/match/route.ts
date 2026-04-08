// POST /api/comptabilite/bank/transactions/[id]/match
// Body: { kind: 'expense' | 'invoice', target_id: uuid, method?: 'manual'|'ai', confidence?: number }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { applyMatch } from '@/lib/comptabilite/reconciliation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: { kind?: string; target_id?: string; method?: string; confidence?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  if (body.kind !== 'expense' && body.kind !== 'invoice') {
    return NextResponse.json({ error: 'kind doit être expense ou invoice' }, { status: 400 });
  }
  if (!body.target_id) {
    return NextResponse.json({ error: 'target_id requis' }, { status: 400 });
  }

  // Vérifie que la transaction est bien accessible (RLS)
  const { data: tx } = await sb
    .from('bank_transactions')
    .select('id, user_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!tx) {
    return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 });
  }

  const method = (body.method === 'ai' || body.method === 'auto' ? body.method : 'manual') as
    | 'manual'
    | 'ai'
    | 'auto';
  const confidence = typeof body.confidence === 'number' ? body.confidence : 1.0;

  try {
    await applyMatch(supabaseAdmin, params.id, body.kind, body.target_id, method, confidence);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur de matching' },
      { status: 500 },
    );
  }
}
