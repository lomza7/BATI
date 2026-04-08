// GET    /api/comptabilite/bank/statements/[id] — détail + transactions
// DELETE /api/comptabilite/bank/statements/[id] — suppression (cascade)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Non authentifié', status: 401 as const };
  const token = authHeader.replace('Bearer ', '').trim();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return { error: 'Non authentifié', status: 401 as const };
  return { sb, user };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authUser(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: statement, error: stErr } = await auth.sb
    .from('bank_statements')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (stErr || !statement) {
    return NextResponse.json({ error: 'Relevé introuvable' }, { status: 404 });
  }

  const { data: transactions, error: txErr } = await auth.sb
    .from('bank_transactions')
    .select('*')
    .eq('statement_id', params.id)
    .order('transaction_date', { ascending: false });

  if (txErr) {
    return NextResponse.json({ error: txErr.message }, { status: 500 });
  }

  return NextResponse.json({ statement, transactions: transactions || [] });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authUser(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Récupère le storage_path avant suppression
  const { data: statement } = await auth.sb
    .from('bank_statements')
    .select('storage_path')
    .eq('id', params.id)
    .maybeSingle();

  // Supprime le relevé (CASCADE supprime les transactions)
  const { error } = await auth.sb.from('bank_statements').delete().eq('id', params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Supprime le fichier dans le storage si présent (best-effort)
  if (statement?.storage_path) {
    try {
      await supabaseAdmin.storage.from('bank-statements').remove([statement.storage_path]);
    } catch (e) {
      console.error('Storage delete failed:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
