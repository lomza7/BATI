import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAiLimit, trackAiUsage } from '@/lib/ai-usage';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';

export const runtime = 'nodejs';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

async function loadOpenAiKey(): Promise<string> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await sb
    .from('platform_secrets')
    .select('key, value')
    .eq('key', 'openai_api_key')
    .maybeSingle();
  return data?.value || '';
}

export async function POST(request: Request) {
  const apiKey = await loadOpenAiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Cle API OpenAI manquante. Configure-la dans Administration.' },
      { status: 503 }
    );
  }

  // Auth
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
  const rl = checkRateLimit(`ai-site-content:${user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  // Check AI limit
  const limitCheck = await checkAiLimit(user.id);
  if (!limitCheck.allowed) {
    return NextResponse.json({ error: limitCheck.reason }, { status: 429 });
  }

  try {
    const body = await request.json();
    const {
      company_name,
      activity,
      city,
      slogan,
      description,
      years_experience,
      zone,
      certifications,
      values,
      target_clients,
      services,
      theme,
      review_count,
      avg_rating,
    } = body as {
      company_name: string;
      activity: string;
      city: string;
      slogan?: string;
      description?: string;
      years_experience?: string;
      zone?: string;
      certifications?: string[];
      values?: string;
      target_clients?: string;
      services?: { name: string; description?: string }[];
      theme?: string;
      review_count?: number;
      avg_rating?: string;
    };

    if (!company_name?.trim() || !activity?.trim()) {
      return NextResponse.json({ error: 'company_name et activity requis' }, { status: 400 });
    }

    const servicesList = (services || [])
      .map(s => `- ${s.name}${s.description ? `: ${s.description}` : ''}`)
      .join('\n');

    const certList = (certifications || []).join(', ');

    const systemPrompt = `Tu es un copywriter expert specialise dans les sites vitrines pour artisans du batiment en France. Tu maitrises le SEO local, la redaction persuasive et la conversion web. Tu ecris un contenu authentique, professionnel et chaleureux qui donne envie aux visiteurs de contacter l'artisan. Tout le contenu est en francais. Tu ne dois jamais inventer de fausses informations (faux chiffres, fausses certifications).`;

    const userPrompt = `Genere le contenu complet d'un site vitrine haut de gamme pour cet artisan du batiment :

═══ INFORMATIONS DE L'ARTISAN ═══
**Entreprise** : ${company_name.trim()}
**Activite** : ${activity.trim()}
**Ville** : ${city?.trim() || 'Non precisee'}
${years_experience ? `**Experience** : ${years_experience} ans` : ''}
${slogan ? `**Slogan** : ${slogan.trim()}` : ''}
${description ? `**Description** : ${description.trim()}` : ''}
${zone ? `**Zone d'intervention** : ${zone.trim()}` : ''}
${target_clients ? `**Clients cibles** : ${target_clients.trim()}` : ''}
${certList ? `**Certifications** : ${certList}` : ''}
${values ? `**Valeurs / Differenciants** : ${values.trim()}` : ''}
${servicesList ? `**Services proposes** :\n${servicesList}` : ''}
${review_count && review_count > 0 ? `**Avis clients** : ${review_count} avis, note moyenne ${avg_rating}/5` : ''}
${theme ? `**Style du site** : ${theme}` : ''}

═══ CONSIGNES DE REDACTION ═══
- Le hero doit etre percutant et donner envie d'agir immediatement
- La section "A propos" doit raconter une histoire, pas juste lister des faits
- Si l'artisan a des certifications, mets-les en avant naturellement dans le texte
- Cree des "highlights" (chiffres cles) uniquement avec des donnees reelles fournies (experience, avis)
- Les descriptions de services doivent expliquer le benefice client, pas juste la prestation technique
- La FAQ doit anticiper les vraies questions des clients (devis, delais, garanties, zone)
- Le SEO doit cibler "[activite] [ville]" et les variantes longue traine
- Utilise un ton professionnel mais accessible, jamais pompeux

═══ FORMAT JSON ═══
Retourne un JSON avec cette structure exacte (pas de commentaires, pas de markdown) :

{
  "hero": {
    "headline": "Titre accrocheur de 6-10 mots, percutant et specifique a l'activite",
    "subheadline": "Sous-titre de 20-30 mots decrivant l'expertise, la zone et le benefice principal",
    "cta_text": "Texte du bouton (ex: Demander un devis gratuit)"
  },
  "about": {
    "title": "Titre engageant (ex: L'expertise au service de votre habitat)",
    "paragraphs": [
      "1er paragraphe (4-5 phrases) : histoire de l'entreprise, expertise, experience. Ton narratif et authentique.",
      "2eme paragraphe (3-4 phrases) : valeurs, engagements, ce qui differencie l'artisan. Inclure les certifications si fournies.",
      "3eme paragraphe (2-3 phrases) : zone d'intervention et disponibilite. Rassurer sur la proximite."
    ],
    "highlights": [
      {"label": "Annees d'experience", "value": "15+"},
      {"label": "Clients satisfaits", "value": "500+"},
      {"label": "Note Google", "value": "4.8/5"}
    ]
  },
  "services": [
    {
      "name": "Nom du service",
      "description": "Description orientee benefice client en 2-3 phrases. Pas juste technique.",
      "icon": "nom lucide-react (Hammer, PaintBucket, Wrench, Home, Shield, Ruler, Zap, Droplets, Flame, Layers, Brush, HardHat, Building2, Plug, Thermometer, Pipette, TreePine, Warehouse, Lightbulb, Settings)"
    }
  ],
  "faq": [
    {
      "question": "Question frequente pertinente",
      "answer": "Reponse complete et rassurante en 2-3 phrases"
    }
  ],
  "contact": {
    "title": "Titre invitant au contact",
    "description": "Texte de 2-3 phrases qui rassure et incite a appeler ou demander un devis"
  },
  "seo": {
    "meta_title": "Titre SEO 50-60 caracteres, format: [Activite] [Ville] - [Nom entreprise]",
    "meta_description": "Meta description 140-155 caracteres, inclut activite + ville + benefice unique + CTA"
  },
  "footer": {
    "tagline": "Court slogan memorable de 5-8 mots"
  }
}

═══ REGLES STRICTES ═══
- Les "highlights" ne doivent contenir QUE des donnees reelles : utilise l'experience, le nombre d'avis et la note si fournis. Si pas de donnees, mets 2-3 highlights generiques ("Devis gratuit", "Intervention rapide", etc.)
- Si des services sont fournis, utilise-les et enrichis les descriptions. Sinon, invente 4-6 services typiques.
- Genere 4-6 questions FAQ pertinentes pour cette activite et cette zone.
- Pas d'emojis, pas de majuscules excessives, pas de points d'exclamation abusifs.
- Les icones doivent etre des noms valides de lucide-react.
- Ne mets JAMAIS de faux chiffres (ex: "500 chantiers" si non fourni).`;

    const model = process.env.OPENAI_TEXT_MODEL || DEFAULT_MODEL;

    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return apiError('AI_FAILED', {
        cause: text,
        context: { route: 'ai/site-content', user_id: user.id, status: res.status },
      });
    }

    const data = await res.json();
    const rawText: string = data.choices?.[0]?.message?.content || '';
    if (!rawText) {
      throw new Error('Reponse IA vide');
    }
    const siteContent = JSON.parse(rawText);

    // Track usage
    trackAiUsage({
      user_id: user.id,
      route: 'ai/site-content',
      model,
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
      status: 'success',
    }).catch(() => {});

    return NextResponse.json({ site_content: siteContent });
  } catch (err) {
    return apiError('INTERNAL', {
      cause: err,
      context: { route: 'ai/site-content', user_id: user.id },
    });
  }
}
