import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

// POST /api/rendus/public/[token]/favorite
// Body: { session_token, generation_id, is_favorite }
export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  const campaignToken = String(params.token || '').trim();
  if (!campaignToken) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionToken = String(body?.session_token || '').trim();
  const generationId = String(body?.generation_id || '').trim();
  const isFavorite = Boolean(body?.is_favorite);

  if (!sessionToken || !generationId) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const { data: campaign } = await supabaseAdmin
    .from('rendu_campaigns')
    .select('id')
    .eq('token', campaignToken)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });

  const { data: lead } = await supabaseAdmin
    .from('rendu_leads')
    .select('id')
    .eq('session_token', sessionToken)
    .eq('campaign_id', campaign.id)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Session invalide' }, { status: 401 });

  // Verify the generation belongs to this lead before mutating
  const { data: generation } = await supabaseAdmin
    .from('rendu_generations')
    .select('id, lead_id')
    .eq('id', generationId)
    .maybeSingle();
  if (!generation || generation.lead_id !== lead.id) {
    return NextResponse.json({ error: 'Generation introuvable' }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('rendu_generations')
    .update({ is_favorite: isFavorite })
    .eq('id', generationId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
