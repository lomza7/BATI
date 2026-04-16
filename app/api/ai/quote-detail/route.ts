import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trackAiUsage } from '@/lib/ai-usage';
import { requireProAccess } from '@/lib/credits';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';
import { callOpenAI, OpenAIError, DEFAULT_OPENAI_MODEL } from '@/lib/ai/openai';

export const runtime = 'nodejs';

function extractJson(content: string): string {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Pas de JSON dans la reponse IA');
  return content.slice(start, end + 1);
}

interface OtherLine {
  description: string;
  detail?: string | null;
  quantity?: number;
  unit?: string | null;
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const rl = checkRateLimit(`ai-quote-detail:${user.id}`, 30, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const gate = await requireProAccess(user.id);
  if (!gate.ok) {
    return NextResponse.json({ error: 'Abonnement Pro requis.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      description,
      existing_detail,
      quote_title,
      other_lines,
    } = body as {
      description?: string;
      existing_detail?: string | null;
      quote_title?: string | null;
      other_lines?: OtherLine[];
    };

    const cleanDescription = (description || '').trim();
    if (!cleanDescription) {
      return NextResponse.json({ error: 'Titre de la prestation requis' }, { status: 400 });
    }

    const { data: profile } = await userClient
      .from('profiles')
      .select('company_name, company_activity, naf_label, company_city')
      .eq('id', user.id)
      .maybeSingle();

    const hasExisting = typeof existing_detail === 'string' && existing_detail.trim().length > 0;
    const mode = hasExisting ? 'améliorer' : 'générer';

    const otherLinesText = (other_lines || [])
      .filter((l) => l.description && l.description.trim() !== cleanDescription)
      .slice(0, 10)
      .map((l) => `- ${l.description}${l.quantity ? ` (${l.quantity}${l.unit ? ' ' + l.unit : ''})` : ''}`)
      .join('\n');

    const systemPrompt = `Tu rédiges le détail technique d'une ligne de devis pour un artisan français du BTP. Tu dois ${mode} le détail de la prestation en te basant sur le métier de l'artisan, le titre de la ligne et le contexte du devis. Le détail doit être concret, professionnel, orienté client (rassurer et clarifier ce qui est inclus).`;

    const userPrompt = `Rédige le détail de cette ligne de devis.

═══ ARTISAN ═══
Entreprise : ${profile?.company_name || 'Artisan du bâtiment'}
Activité : ${profile?.company_activity || 'Bâtiment'}
${profile?.naf_label ? `Code NAF : ${profile.naf_label}` : ''}
${profile?.company_city ? `Ville : ${profile.company_city}` : ''}

═══ DEVIS ═══
${quote_title ? `Titre du devis : ${quote_title}` : ''}
${otherLinesText ? `Autres prestations du devis :\n${otherLinesText}` : ''}

═══ LIGNE À DÉTAILLER ═══
Titre : ${cleanDescription}
${hasExisting ? `Détail existant (à améliorer, à reformuler et à enrichir — ne pas le jeter) :\n${existing_detail}` : 'Aucun détail encore. À générer de zéro.'}

═══ CONSIGNES ═══
- 3 à 6 puces maximum, chacune courte (6-15 mots), concrète et technique.
- Chaque puce commence par "• " (puce Unicode + espace).
- Sépare les puces par un unique saut de ligne (\\n), pas de ligne vide.
- Pas de majuscules en début sauf si nom propre, pas de point final.
- Ne mentionne jamais un prix, une durée, une quantité (ces champs sont ailleurs sur la ligne).
- Reste dans le métier de l'artisan. Si le titre est hors métier, génère quand même mais signale-le brièvement.
- Pas de phrase d'intro ni de conclusion, juste les puces.
- ${hasExisting ? 'Conserve l\'intention du détail existant, enrichis et clarifie.' : 'Base-toi sur des pratiques courantes du métier.'}

═══ FORMAT JSON STRICT ═══
{
  "detail": "• première puce\\n• deuxième puce\\n• troisième puce"
}`;

    const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

    const data = await callOpenAI({
      max_tokens: 500,
      temperature: 0.5,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const rawText = data.content?.[0]?.text || '';
    const jsonStr = extractJson(rawText);
    const parsed = JSON.parse(jsonStr) as { detail?: unknown };

    const detail = typeof parsed.detail === 'string' ? parsed.detail.trim() : '';
    if (!detail) {
      return apiError('AI_PARSE', {
        message: "L'IA n'a pas pu générer le détail.",
        context: { route: 'ai/quote-detail', user_id: user.id },
      });
    }

    trackAiUsage({
      user_id: user.id,
      route: 'ai/quote-detail',
      model,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      status: 'success',
    }).catch(() => {});

    const titleNorm = cleanDescription
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
    if (titleNorm) {
      await userClient
        .from('prestation_details')
        .upsert(
          {
            user_id: user.id,
            title_norm: titleNorm,
            title: cleanDescription,
            detail,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,title_norm' }
        );
    }

    return NextResponse.json({ detail });
  } catch (err) {
    if (err instanceof OpenAIError) {
      return apiError('AI_FAILED', {
        cause: err.body,
        context: { route: 'ai/quote-detail', user_id: user.id, status: err.status },
      });
    }
    return apiError('INTERNAL', {
      cause: err,
      context: { route: 'ai/quote-detail', user_id: user.id },
    });
  }
}
