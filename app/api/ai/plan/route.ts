import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trackAiUsage } from '@/lib/ai-usage';
import { requireProAccess } from '@/lib/credits';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';

export const runtime = 'nodejs';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `Tu es un architecte specialise dans la lecture de croquis et esquisses a main levee.
On te donne la photo d'un croquis/esquisse dessine par un artisan du batiment.

Tu dois analyser ce croquis et generer un plan technique structure en JSON.

Regles :
- Identifie chaque piece (nom, dimensions approximatives en metres)
- Place les pieces sur une grille coherente (x, y en metres depuis le coin haut-gauche)
- Identifie portes et fenetres si visibles
- Respecte les proportions du croquis original
- Si les dimensions ne sont pas ecrites, estime-les de maniere realiste
- Les murs font 0.15m d'epaisseur
- Genere un titre descriptif pour le plan

Reponds UNIQUEMENT avec du JSON valide, sans markdown, sans explication :
{
  "title": "Plan RDC - Maison individuelle",
  "total_width": 12,
  "total_height": 10,
  "rooms": [
    {
      "name": "Salon",
      "x": 0,
      "y": 0,
      "width": 5,
      "height": 4,
      "doors": [
        { "wall": "south", "position": 0.5, "width": 0.9 }
      ],
      "windows": [
        { "wall": "east", "position": 0.3, "width": 1.2 }
      ]
    }
  ]
}

position = fraction (0 a 1) le long du mur ou se trouve l'element.
wall = "north" (haut), "south" (bas), "east" (droite), "west" (gauche).
width = largeur de la porte/fenetre en metres.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY manquante' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  // Burst protection (sliding window) — per-user, plan IA is Claude vision
  const rl = checkRateLimit(`ai-plan:${user.id}`, 15, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const gate = await requireProAccess(user.id);
  if (!gate.ok) {
    return NextResponse.json({ error: 'Abonnement Pro requis.' }, { status: 403 });
  }

  const formData = await request.formData();
  const photo = formData.get('photo') as File | null;
  const notes = (formData.get('notes') as string) || '';

  if (!photo) {
    return NextResponse.json({ error: 'Photo du croquis requise' }, { status: 400 });
  }

  const arrayBuffer = await photo.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mediaType = photo.type === 'image/png' ? 'image/png' : 'image/jpeg';

  const userMessage = notes
    ? `Voici le croquis. Notes de l'artisan : ${notes}`
    : 'Voici le croquis a analyser.';

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 4096,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              { type: 'text', text: userMessage },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return apiError('AI_FAILED', {
        cause: err,
        context: { route: 'ai/plan', user_id: user.id, status: response.status },
      });
    }

    const data = await response.json() as {
      content: { type: string; text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const rawText = data.content?.[0]?.text || '';

    // Extract JSON from response
    let plan;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      plan = JSON.parse(jsonMatch?.[0] || rawText);
    } catch (e) {
      return apiError('AI_PARSE', {
        cause: e,
        context: { route: 'ai/plan', user_id: user.id, raw_preview: rawText.slice(0, 200) },
      });
    }

    await trackAiUsage({
      user_id: user.id,
      route: 'ai/plan',
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    });

    return NextResponse.json({ plan });
  } catch (error) {
    return apiError('INTERNAL', {
      cause: error,
      context: { route: 'ai/plan', user_id: user.id },
    });
  }
}
