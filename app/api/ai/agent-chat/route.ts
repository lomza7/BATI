import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildAgentContext } from '@/lib/ai/agent-chat';
import { trackAiUsage } from '@/lib/ai-usage';
import { consumeAi } from '@/lib/credits';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';

export const runtime = 'nodejs';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY manquante' }, { status: 503 });
  }

  // Auth
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

  // Burst protection (sliding window) — per-user
  const rl = checkRateLimit(`ai-agent-chat:${user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const gate = await consumeAi(user.id, 'agent');
  if (!gate.ok) {
    if (gate.reason === 'no_pro_access') {
      return NextResponse.json({ error: 'Abonnement Pro requis.' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Cr\u00e9dits IA insuffisants.', balance: gate.balance, required: gate.required },
      { status: 402 },
    );
  }

  // Parse body
  const body = await request.json().catch(() => null);
  if (!body?.agent_id || !body?.message) {
    return NextResponse.json({ error: 'agent_id et message requis' }, { status: 400 });
  }

  const { agent_id, message, conversation_id, image } = body as {
    agent_id: string;
    message: string;
    conversation_id?: string;
    image?: { media_type: string; data: string } | null;
  };

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (image && !ALLOWED_IMAGE_TYPES.includes(image.media_type)) {
    return NextResponse.json({ error: 'Format image non supporté (jpeg, png, webp, gif uniquement).' }, { status: 400 });
  }
  if (image && image.data.length > 7_500_000) {
    return NextResponse.json({ error: 'Image trop volumineuse (max ~5 Mo).' }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Verify agent access (own or global)
  const { data: agent } = await sb
    .from('ai_agents')
    .select('id, name, user_id, is_global')
    .eq('id', agent_id)
    .single();

  if (!agent || (agent.user_id !== user.id && !agent.is_global)) {
    return NextResponse.json({ error: 'Agent introuvable' }, { status: 404 });
  }

  // Get or create conversation
  let convId = conversation_id;
  if (!convId) {
    const { data: conv, error: convError } = await sb
      .from('ai_conversations')
      .insert({
        agent_id,
        user_id: user.id,
        title: message.slice(0, 80),
      })
      .select('id')
      .single();

    if (convError || !conv) {
      return NextResponse.json({ error: 'Erreur creation conversation' }, { status: 500 });
    }
    convId = conv.id;
  }

  // Load conversation history (last 20 messages)
  const { data: history } = await sb
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(20);

  // Insert user message (image presence noted in text for history context)
  const storedUserContent = image ? `[Image jointe]\n${message}` : message;
  await sb.from('ai_messages').insert({
    conversation_id: convId,
    user_id: user.id,
    role: 'user',
    content: storedUserContent,
  });

  // Build context
  const { systemPrompt, documentContext } = await buildAgentContext(agent_id);

  const fullSystemPrompt = [
    systemPrompt,
    documentContext
      ? `\n\nTu disposes de la base de connaissances suivante. Utilise-la pour repondre avec precision :\n${documentContext}`
      : '',
    "\n\nMethode de dialogue : avant de donner une reponse definitive, pose systematiquement 1 a 3 questions ciblees pour bien cerner la situation de l'artisan (contexte du chantier, materiaux, contraintes, budget, delais, localisation, etc. selon la pertinence). Attends ses reponses, puis formule une reponse precise et actionnable qui s'appuie sur les elements fournis. Si la demande est deja tres precise et ne necessite aucune clarification, reponds directement.",
    '\n\nReponds toujours en francais. Sois precis, concis et utile.',
  ].join('');

  // Build messages array (current user turn can include an image block)
  const currentUserContent = image
    ? [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: image.media_type, data: image.data } },
        { type: 'text' as const, text: message },
      ]
    : message;

  const messages: { role: string; content: unknown }[] = [
    ...(history || []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: currentUserContent },
  ];

  // Call Claude
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
        system: fullSystemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return apiError('AI_FAILED', {
        cause: err,
        context: { route: 'ai/agent-chat', user_id: user.id, status: response.status },
      });
    }

    const data = await response.json() as {
      content: { type: string; text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const reply = data.content?.[0]?.text || '';

    // Save assistant message
    const { data: savedMsg } = await sb
      .from('ai_messages')
      .insert({
        conversation_id: convId,
        user_id: user.id,
        role: 'assistant',
        content: reply,
      })
      .select('id')
      .single();

    // Track usage
    await trackAiUsage({
      user_id: user.id,
      route: 'ai/agent-chat',
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    });

    return NextResponse.json({
      response: reply,
      conversation_id: convId,
      message_id: savedMsg?.id || null,
    });
  } catch (error) {
    return apiError('INTERNAL', {
      cause: error,
      context: { route: 'ai/agent-chat', user_id: user.id },
    });
  }
}
