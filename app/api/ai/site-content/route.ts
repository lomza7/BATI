import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAiLimit, trackAiUsage } from '@/lib/ai-usage';

export const runtime = 'nodejs';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function extractJson(content: string): string {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Pas de JSON dans la reponse IA');
  return content.slice(start, end + 1);
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY manquante' }, { status: 503 });
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

    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        system: systemPrompt,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Anthropic API error:', text);
      return NextResponse.json({ error: 'Erreur API IA' }, { status: 502 });
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.text || '';
    const jsonStr = extractJson(rawText);
    const siteContent = JSON.parse(jsonStr);

    // Track usage
    trackAiUsage({
      user_id: user.id,
      route: 'ai/site-content',
      model,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      status: 'success',
    }).catch(() => {});

    return NextResponse.json({ site_content: siteContent });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    console.error('AI site-content error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
