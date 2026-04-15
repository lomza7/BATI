import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const MAX_SIGNATURE_BYTES = 500_000;

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(`sign-quote:${getClientIp(request)}`, 10, 60_000);
    if (!rl.ok) return rateLimitResponse(rl) as unknown as NextResponse;

    const body = await request.json();
    const { token, signature_data_url, signer_user_agent } = body ?? {};

    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
    }
    if (typeof signature_data_url !== 'string' || !signature_data_url.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
    }

    const base64 = signature_data_url.slice('data:image/png;base64,'.length);
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_SIGNATURE_BYTES) {
      return NextResponse.json({ error: 'Signature hors limites' }, { status: 400 });
    }

    const { data: sendRow, error: sendErr } = await supabaseAdmin
      .from('quote_sends')
      .select('id, expires_at, signed_at')
      .eq('token', token)
      .maybeSingle();

    if (sendErr || !sendRow) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 404 });
    }
    if (sendRow.expires_at && new Date(sendRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Lien expiré' }, { status: 410 });
    }
    if (sendRow.signed_at) {
      return NextResponse.json({ error: 'Devis déjà signé' }, { status: 409 });
    }

    const filePath = `${sendRow.id}.png`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('signatures')
      .upload(filePath, buffer, { contentType: 'image/png', upsert: true });
    if (uploadErr) {
      return NextResponse.json({ error: 'Upload signature échoué' }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from('signatures').getPublicUrl(filePath);
    const signatureUrl = urlData.publicUrl;

    const { data: result, error: rpcErr } = await supabaseAdmin.rpc('sign_quote', {
      p_token: token,
      p_signature_url: signatureUrl,
      p_signer_user_agent: typeof signer_user_agent === 'string' ? signer_user_agent.slice(0, 500) : '',
    });

    if (rpcErr) {
      return NextResponse.json({ error: 'Signature rejetée' }, { status: 500 });
    }

    return NextResponse.json({ ...(result as object), signature_url: signatureUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
