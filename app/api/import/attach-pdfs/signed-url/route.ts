/**
 * POST /api/import/attach-pdfs/signed-url
 * Body: { path: string }
 *
 * Retourne une URL signee (1 heure) pour afficher le PDF d'origine d'un
 * devis ou d'une facture importee dans la preview dialog.
 *
 * La RLS du bucket s'applique via le client authentifie : un utilisateur ne
 * peut signer un path que s'il est dans son propre dossier workspace.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const path = typeof body?.path === 'string' ? body.path : null;
  if (!path) {
    return NextResponse.json({ error: 'path requis' }, { status: 400 });
  }

  const { data, error } = await sb.storage
    .from('imported-documents')
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || 'Impossible de générer l\'URL signée' },
      { status: 404 },
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
