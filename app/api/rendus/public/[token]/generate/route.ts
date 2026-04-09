import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateImage } from '@/lib/ai/image-generation';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const maxDuration = 120;

const STYLE_PROMPTS: Record<string, string> = {
  moderne: 'modern contemporary interior, clean lines, neutral palette, designer furniture, large windows with natural light',
  classique: 'classic traditional French interior, elegant moldings, parquet floor, refined furnishings, warm tones',
  industriel: 'industrial loft style, exposed brick, raw concrete, black metal frames, vintage Edison bulbs',
  scandinave: 'scandinavian style, light wood, white walls, minimalist, cozy textiles, warm Nordic light',
  mediterraneen: 'mediterranean style, terracotta floor tiles, lime-washed walls, natural stone, terra cotta accents, warm sunlight',
  zen: 'japandi zen style, light wood, low furniture, neutral palette, indoor plants, soft diffused light',
};

const ROOM_HINTS: Record<string, string> = {
  Salon: 'living room',
  Cuisine: 'kitchen',
  'Salle de bain': 'bathroom',
  Chambre: 'bedroom',
  Terrasse: 'terrace',
  Bureau: 'home office',
  'Entrée': 'entrance hall',
};

// POST /api/rendus/public/[token]/generate
// Body: { session_token, room_type, style, image_base64, image_mime }
// Generates the after photo via OpenAI/Gemini, uploads both before/after
// to the rendu-images bucket and returns the URLs.
export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  const campaignToken = String(params.token || '').trim();
  if (!campaignToken || campaignToken.length < 16) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  // Burst protection (sliding window) — par IP en premier rideau
  // (le rate-limit par session est ajouté plus bas après validation du lead)
  const ip = getClientIp(request);
  const rlIp = checkRateLimit(`rendu-generate:ip:${ip}`, 10, 60_000);
  if (!rlIp.ok) return rateLimitResponse(rlIp);

  const body = await request.json().catch(() => ({}));
  const sessionToken = String(body?.session_token || '').trim();
  const roomType = String(body?.room_type || '').trim();
  const style = String(body?.style || '').trim();
  const imageBase64 = String(body?.image_base64 || '').trim();
  const imageMime = String(body?.image_mime || 'image/jpeg').trim();

  if (!sessionToken || sessionToken.length < 16) {
    return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
  }
  if (!imageBase64) {
    return NextResponse.json({ error: 'Photo manquante' }, { status: 400 });
  }
  if (!style || !STYLE_PROMPTS[style]) {
    return NextResponse.json({ error: 'Style invalide' }, { status: 400 });
  }

  // Validate session against campaign
  const { data: campaign } = await supabaseAdmin
    .from('rendu_campaigns')
    .select('id, user_id, status, expires_at')
    .eq('token', campaignToken)
    .maybeSingle();
  if (!campaign || campaign.status !== 'active' || new Date(campaign.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Campagne invalide' }, { status: 404 });
  }

  const { data: lead } = await supabaseAdmin
    .from('rendu_leads')
    .select('id, campaign_id, user_id, generation_count')
    .eq('session_token', sessionToken)
    .maybeSingle();
  if (!lead || lead.campaign_id !== campaign.id) {
    return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
  }

  // Burst protection par session (en plus du cap lifetime à 12)
  const rlSession = checkRateLimit(`rendu-generate:${sessionToken}`, 5, 60_000);
  if (!rlSession.ok) return rateLimitResponse(rlSession);

  // Cap per-lead generations to avoid abuse
  if ((lead.generation_count || 0) >= 12) {
    return NextResponse.json(
      { error: 'Limite atteinte. Contactez l\'artisan pour plus de rendus.' },
      { status: 429 },
    );
  }

  const roomHint = ROOM_HINTS[roomType] || 'room';
  const stylePrompt = STYLE_PROMPTS[style];
  const prompt = `Renovate this ${roomHint} into a ${stylePrompt}. Keep the same room geometry, walls, windows, and overall layout. Photoreal, high quality, natural lighting, professional interior photography.`;

  let result;
  try {
    result = await generateImage({
      prompt,
      sourceImageBase64: imageBase64,
      sourceImageMime: imageMime,
      size: '1024x1024',
    });
  } catch (e) {
    return apiError('AI_FAILED', {
      cause: e,
      context: { route: 'rendus/public/generate', campaign_id: campaign.id, lead_id: lead.id },
    });
  }

  // Upload both before + after to storage
  const generationId = crypto.randomUUID();
  const folder = `${lead.user_id}/${campaign.id}/${lead.id}`;
  const beforeExt = imageMime.includes('png') ? 'png' : 'jpg';
  const beforePath = `${folder}/${generationId}-before.${beforeExt}`;
  const afterPath = `${folder}/${generationId}-after.png`;

  const beforeBuffer = Buffer.from(imageBase64, 'base64');
  const afterBuffer = Buffer.from(result.imageBase64, 'base64');

  const { error: beforeUploadErr } = await supabaseAdmin.storage
    .from('rendu-images')
    .upload(beforePath, beforeBuffer, {
      contentType: imageMime,
      upsert: false,
    });
  if (beforeUploadErr) {
    return apiError('UPLOAD_FAILED', {
      cause: beforeUploadErr,
      context: { route: 'rendus/public/generate', step: 'before_upload', path: beforePath },
    });
  }

  const { error: afterUploadErr } = await supabaseAdmin.storage
    .from('rendu-images')
    .upload(afterPath, afterBuffer, {
      contentType: result.mimeType || 'image/png',
      upsert: false,
    });
  if (afterUploadErr) {
    return apiError('UPLOAD_FAILED', {
      cause: afterUploadErr,
      context: { route: 'rendus/public/generate', step: 'after_upload', path: afterPath },
    });
  }

  const { data: beforeUrlData } = supabaseAdmin.storage
    .from('rendu-images')
    .getPublicUrl(beforePath);
  const { data: afterUrlData } = supabaseAdmin.storage
    .from('rendu-images')
    .getPublicUrl(afterPath);

  const { data: generation, error: insertError } = await supabaseAdmin
    .from('rendu_generations')
    .insert({
      lead_id: lead.id,
      campaign_id: campaign.id,
      user_id: lead.user_id,
      room_type: roomType,
      style,
      before_path: beforePath,
      after_path: afterPath,
      before_url: beforeUrlData.publicUrl,
      after_url: afterUrlData.publicUrl,
      provider: result.provider,
      model: result.model,
    })
    .select('*')
    .single();

  if (insertError || !generation) {
    return apiError('DB_WRITE', {
      cause: insertError,
      context: { route: 'rendus/public/generate', step: 'insert_generation', lead_id: lead.id },
    });
  }

  await supabaseAdmin
    .from('rendu_leads')
    .update({
      generation_count: (lead.generation_count || 0) + 1,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', lead.id);

  return NextResponse.json({ generation });
}

// GET /api/rendus/public/[token]/generate?session_token=...
// Returns the gallery of generations for the current lead session.
export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  const campaignToken = String(params.token || '').trim();
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get('session_token') || '';

  if (!campaignToken || !sessionToken) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const { data: campaign } = await supabaseAdmin
    .from('rendu_campaigns')
    .select('id')
    .eq('token', campaignToken)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'Campagne invalide' }, { status: 404 });

  const { data: lead } = await supabaseAdmin
    .from('rendu_leads')
    .select('id')
    .eq('session_token', sessionToken)
    .eq('campaign_id', campaign.id)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Session invalide' }, { status: 401 });

  const { data: generations } = await supabaseAdmin
    .from('rendu_generations')
    .select('id, room_type, style, before_url, after_url, is_favorite, created_at')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ generations: generations || [] });
}
