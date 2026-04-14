import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trackAiUsage } from '@/lib/ai-usage';
import { requireProAccess } from '@/lib/credits';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';

export const runtime = 'nodejs';

// Groq exposes an OpenAI-compatible Whisper endpoint. Large v3 Turbo is the
// fastest model available (~0.5s for a 30s clip, ~10x faster than OpenAI),
// French accuracy is excellent and pricing is ~0.0007€/min — an order of
// magnitude cheaper than the OpenAI Whisper API.
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3-turbo';

// Groq hard limit is 25 MB per request. Our client auto-stops at 120s which,
// at 64 kbps opus, sits comfortably below ~1 MB — the 25 MB cap is just a
// safety net for browsers that negotiate a much higher bitrate.
const MAX_SIZE = 25 * 1024 * 1024;

async function loadGroqKey(): Promise<string> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data } = await sb
    .from('platform_secrets')
    .select('value')
    .eq('key', 'groq_api_key')
    .maybeSingle();
  return data?.value || process.env.GROQ_API_KEY || '';
}

export async function POST(request: Request) {
  const apiKey = await loadGroqKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Clé API Groq manquante. Configure-la dans Administration.' },
      { status: 503 },
    );
  }

  // Auth — same pattern as /api/ai/quote so plan limits apply here too.
  const authHeader = request.headers.get('authorization');
  let userId: string | null = null;
  if (authHeader) {
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id || null;
  }

  // Burst protection — generous since one quote session can easily trigger
  // 4-5 transcriptions (initial + up to 3 clarification answers by voice).
  const rlKey = userId ? `ai-transcribe:${userId}` : `ai-transcribe:ip:${getClientIp(request)}`;
  const rl = checkRateLimit(rlKey, 30, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  if (!userId) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }
  const gate = await requireProAccess(userId);
  if (!gate.ok) {
    return NextResponse.json({ error: 'Abonnement Pro requis.' }, { status: 403 });
  }

  let audioFile: File;
  try {
    const formData = await request.formData();
    const entry = formData.get('file');
    if (!(entry instanceof File)) {
      return NextResponse.json({ error: 'Aucun fichier audio reçu.' }, { status: 400 });
    }
    audioFile = entry;
  } catch (error) {
    return apiError('BAD_REQUEST', {
      message: 'Requête audio invalide.',
      cause: error,
      context: { route: 'ai/transcribe', user_id: userId },
    });
  }

  if (audioFile.size === 0) {
    return NextResponse.json({ error: 'Enregistrement audio vide.' }, { status: 400 });
  }
  if (audioFile.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'Enregistrement trop long. Maximum 2 minutes.' },
      { status: 413 },
    );
  }

  try {
    // Re-post the audio file to Groq as multipart/form-data. We don't buffer
    // the audio into memory twice — the File from the incoming FormData is
    // piped straight through.
    const upstreamForm = new FormData();
    upstreamForm.append('file', audioFile, audioFile.name || 'recording.webm');
    upstreamForm.append('model', MODEL);
    upstreamForm.append('language', 'fr');
    upstreamForm.append('response_format', 'json');
    upstreamForm.append('temperature', '0');

    const groqResponse = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      return apiError('AI_FAILED', {
        message: "La transcription vocale a échoué. Réessaie dans un instant.",
        cause: errorText,
        context: { route: 'ai/transcribe', user_id: userId, status: groqResponse.status },
      });
    }

    const payload = (await groqResponse.json()) as { text?: string };
    const transcript = (payload.text || '').trim();

    if (!transcript) {
      return NextResponse.json(
        { error: "Aucune parole détectée. Réessaie en parlant plus près du micro." },
        { status: 422 },
      );
    }

    if (userId) {
      // Groq doesn't return token counts for audio — we approximate output
      // tokens from transcript length so usage dashboards still have a
      // meaningful signal.
      trackAiUsage({
        user_id: userId,
        route: 'ai/transcribe',
        model: MODEL,
        input_tokens: 0,
        output_tokens: Math.ceil(transcript.length / 4),
        status: 'success',
      }).catch(() => {});
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    return apiError('INTERNAL', {
      message: "La transcription vocale a échoué.",
      cause: error,
      context: { route: 'ai/transcribe', user_id: userId },
    });
  }
}
