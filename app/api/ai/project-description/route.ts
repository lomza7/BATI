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

  // Burst protection (sliding window) — per-user
  const rl = checkRateLimit(`ai-project-description:${user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const gate = await requireProAccess(user.id);
  if (!gate.ok) {
    return NextResponse.json({ error: 'Abonnement Pro requis.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { project_id, name, city } = body as {
      project_id: string;
      name: string;
      city?: string | null;
    };

    if (!project_id || !name) {
      return NextResponse.json({ error: 'project_id et name requis' }, { status: 400 });
    }

    // Fetch project context : notes, quotes with lines, profile
    const [{ data: project }, { data: quotes }, { data: profile }] = await Promise.all([
      userClient
        .from('projects')
        .select('id, name, notes, address, city, start_date, end_date, budget, public_category')
        .eq('id', project_id)
        .maybeSingle(),
      userClient
        .from('quotes')
        .select('title, quote_lines(description, quantity, unit)')
        .eq('project_id', project_id)
        .is('deleted_at', null)
        .limit(3),
      userClient
        .from('profiles')
        .select('company_name, company_activity, company_city')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    const quoteLines = (quotes || [])
      .flatMap((q: { quote_lines?: { description: string; quantity: number; unit: string }[] }) =>
        (q.quote_lines || []).map((l) => `- ${l.description}${l.quantity ? ` (${l.quantity} ${l.unit || ''})` : ''}`)
      )
      .slice(0, 20)
      .join('\n');

    const systemPrompt = `Tu es un copywriter expert en SEO local pour artisans du batiment en France. Tu ecris des descriptions de chantiers realisees, authentiques et optimisees pour Google (mots cles longue traine, structure HTML implicite). Tout en francais, ton professionnel et concret.`;

    const userPrompt = `Redige une description SEO pour un chantier realise par l'artisan.

═══ ARTISAN ═══
Entreprise : ${profile?.company_name || 'Artisan du batiment'}
Activite : ${profile?.company_activity || 'Batiment'}
Ville : ${profile?.company_city || ''}

═══ CHANTIER ═══
Nom : ${name}
Ville du chantier : ${city || project?.city || 'Non precisee'}
${project?.notes ? `Notes internes : ${project.notes}` : ''}
${project?.budget ? `Budget : ${project.budget} EUR` : ''}
${project?.start_date ? `Debut : ${project.start_date}` : ''}
${project?.end_date ? `Fin : ${project.end_date}` : ''}
${quoteLines ? `Prestations (extraites des devis) :\n${quoteLines}` : ''}

═══ CONSIGNES ═══
- Description entre 150 et 280 mots
- Structure naturelle : contexte du chantier, travaux realises, materiaux/techniques, resultat
- Integre naturellement les mots cles : type de chantier + ville
- Ton professionnel et concret, pas de marketing pompeux
- Pas de listes a puces, du texte courant
- Pas de mention de l'artisan en 3e personne ("Nous avons realise..." marche)
- Ne jamais inventer de details techniques non presents dans les donnees fournies
- Si les donnees sont pauvres, reste general mais credible

═══ FORMAT JSON ═══
{
  "description": "La description complete du chantier en 150-280 mots",
  "category": "Le type de chantier en 2-4 mots (ex: Renovation salle de bain, Extension maison)"
}`;

    const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

    const data = await callOpenAI({
      max_tokens: 1200,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const rawText = data.content?.[0]?.text || '';
    const jsonStr = extractJson(rawText);
    const parsed = JSON.parse(jsonStr);

    trackAiUsage({
      user_id: user.id,
      route: 'ai/project-description',
      model,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      status: 'success',
    }).catch(() => {});

    return NextResponse.json({
      description: parsed.description || '',
      category: parsed.category || '',
    });
  } catch (err) {
    if (err instanceof OpenAIError) {
      return apiError('AI_FAILED', {
        cause: err.body,
        context: { route: 'ai/project-description', user_id: user.id, status: err.status },
      });
    }
    return apiError('INTERNAL', {
      cause: err,
      context: { route: 'ai/project-description', user_id: user.id },
    });
  }
}
