import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL = 60 * 60; // 1 hour

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await sb.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Resolve workspace owner
    const { data: membership } = await supabaseAdmin
      .from('workspace_memberships')
      .select('owner_user_id')
      .eq('member_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    const ownerUserId = membership?.owner_user_id || user.id;

    // Fetch the expense and verify it belongs to the workspace
    const { data: expense, error } = await supabaseAdmin
      .from('expenses')
      .select('id, user_id, receipt_storage_path')
      .eq('id', params.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!expense) return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 });
    if (expense.user_id !== ownerUserId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }
    if (!expense.receipt_storage_path) {
      return NextResponse.json({ error: 'Aucun justificatif attaché' }, { status: 404 });
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from('receipts')
      .createSignedUrl(expense.receipt_storage_path, SIGNED_URL_TTL);

    if (signError || !signed) {
      return NextResponse.json(
        { error: signError?.message || 'Impossible de générer le lien' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: signed.signedUrl,
      expires_in: SIGNED_URL_TTL,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur inconnue' },
      { status: 500 },
    );
  }
}
