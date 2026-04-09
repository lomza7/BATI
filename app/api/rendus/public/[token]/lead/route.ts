import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';

export const runtime = 'nodejs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';

function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

// POST /api/rendus/public/[token]/lead
// Captures the prospect's name + email and returns a session_token
// the visitor uses for subsequent calls (generate, favorite, etc.)
export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  const campaignToken = String(params.token || '').trim();
  if (!campaignToken || campaignToken.length < 16) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  // Burst protection — 10 lead captures par IP par minute
  const ip = getClientIp(request);
  const rl = checkRateLimit(`rendu-lead:ip:${ip}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const body = await request.json().catch(() => ({}));
  const leadName = String(body?.lead_name || '').trim();
  const leadEmail = String(body?.lead_email || '').trim().toLowerCase();
  const turnstileToken = String(body?.turnstile_token || '').trim();
  if (!leadEmail || !leadEmail.includes('@')) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  // Vérification Turnstile (no-op si TURNSTILE_SECRET_KEY pas configurée)
  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json(
      { error: 'Vérification anti-bot échouée. Rechargez la page et réessayez.' },
      { status: 400 },
    );
  }

  const { data: campaign } = await supabaseAdmin
    .from('rendu_campaigns')
    .select('id, user_id, status, expires_at')
    .eq('token', campaignToken)
    .maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }
  if (campaign.status !== 'active') {
    return NextResponse.json({ error: 'Campagne archivée' }, { status: 410 });
  }
  if (new Date(campaign.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Ce lien a expiré' }, { status: 410 });
  }

  // Reuse existing lead if same email already came back
  const { data: existing } = await supabaseAdmin
    .from('rendu_leads')
    .select('id, session_token')
    .eq('campaign_id', campaign.id)
    .eq('lead_email', leadEmail)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('rendu_leads')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', existing.id);
    return NextResponse.json({
      lead_id: existing.id,
      session_token: existing.session_token,
    });
  }

  const sessionToken = generateToken(32);

  const { data: created, error: insertError } = await supabaseAdmin
    .from('rendu_leads')
    .insert({
      campaign_id: campaign.id,
      user_id: campaign.user_id,
      lead_name: leadName,
      lead_email: leadEmail,
      session_token: sessionToken,
    })
    .select('id, session_token')
    .single();

  if (insertError || !created) {
    return apiError('DB_WRITE', {
      message: 'Erreur création lead',
      cause: insertError,
      context: { route: 'rendus/public/lead', campaign_id: campaign.id },
    });
  }

  return NextResponse.json({
    lead_id: created.id,
    session_token: created.session_token,
  });
}
