// POST /api/comptabilite/bank/transactions/[id]/unmatch
// Annule un rapprochement

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { clearMatch } from '@/lib/comptabilite/reconciliation';

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

  // Vérifie l'accès via RLS
  const { data: tx } = await sb
    .from('bank_transactions')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (!tx) {
    return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 });
  }

  try {
    await clearMatch(supabaseAdmin, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 },
    );
  }
}
