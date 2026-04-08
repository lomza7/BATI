import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateToken, trackTokenView } from '@/lib/comptabilite/accountant-scope';

export const runtime = 'nodejs';

const SIGNED_URL_TTL = 60 * 60; // 1 hour

export async function GET(
  _request: Request,
  { params }: { params: { token: string; expenseId: string } },
) {
  const validation = await validateToken(params.token);
  if (!validation.ok || !validation.access) {
    return NextResponse.json(
      { error: validation.error || 'Lien invalide' },
      { status: validation.status },
    );
  }
  const access = validation.access;

  const { data: expense, error } = await supabaseAdmin
    .from('expenses')
    .select('id, user_id, receipt_storage_path, date')
    .eq('id', params.expenseId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!expense) return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 });
  if (expense.user_id !== access.user_id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!expense.receipt_storage_path) {
    return NextResponse.json({ error: 'Aucun justificatif attaché' }, { status: 404 });
  }

  // Verify scope — block if expense date is outside the accountant scope
  const scope = validation.scope!;
  if (scope.start && expense.date && expense.date < scope.start) {
    return NextResponse.json({ error: 'Hors périmètre' }, { status: 403 });
  }
  if (scope.end && expense.date && expense.date > scope.end) {
    return NextResponse.json({ error: 'Hors périmètre' }, { status: 403 });
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

  void trackTokenView(access.id);

  return NextResponse.json({
    url: signed.signedUrl,
    expires_in: SIGNED_URL_TTL,
  });
}
