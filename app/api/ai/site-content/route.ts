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
      services,
      theme,
    } = body as {
      company_name: string;
      activity: string;
      city: string;
      slogan?: string;
      services?: { name: string; description?: string }[];
      theme?: string;
    };

    if (!company_name?.trim() || !activity?.trim()) {
      return NextResponse.json({ error: 'company_name et activity requis' }, { status: 400 });
    }

    const servicesList = (services || [])
      .map(s => `- ${s.name}${s.description ? `: ${s.description}` : ''}`)
      .join('\n');

    const systemPrompt = `Tu es un expert en marketing digital pour les artisans du batiment en France. Tu rediges du contenu professionnel, convaincant et optimise pour le SEO local. Ton style est chaleureux mais professionnel. Tout le contenu est en francais.`;

    const userPrompt = `Genere le contenu complet d'un site vitrine pour cet artisan du batiment :

**Entreprise** : ${company_name.trim()}
**Activite** : ${activity.trim()}
**Ville** : ${city?.trim() || 'Non precisee'}
${slogan ? `**Slogan** : ${slogan.trim()}` : ''}
${servicesList ? `**Services proposes** :\n${servicesList}` : ''}
${theme ? `**Style du site** : ${theme}` : ''}

Retourne un JSON avec cette structure exacte (pas de commentaires, pas de markdown) :

{
  "hero": {
    "headline": "Titre accrocheur en 6-10 mots maximum",
    "subheadline": "Sous-titre de 15-25 mots qui decrit l'expertise et la zone geographique",
    "cta_text": "Texte du bouton d'appel a l'action (ex: Demander un devis gratuit)"
  },
  "about": {
    "title": "Titre de la section A propos (ex: Votre artisan de confiance)",
    "paragraphs": [
      "Premier paragraphe (3-4 phrases) sur l'expertise et l'experience",
      "Deuxieme paragraphe (2-3 phrases) sur les valeurs et engagements"
    ]
  },
  "services": [
    {
      "name": "Nom du service",
      "description": "Description courte en 1-2 phrases",
      "icon": "nom d'icone lucide-react adapte (ex: Hammer, PaintBucket, Wrench, Home, Shield, Ruler, Zap, Droplets, Flame, Layers)"
    }
  ],
  "contact": {
    "title": "Titre section contact (ex: Contactez-nous)",
    "description": "Court texte invitant a prendre contact (1-2 phrases)"
  },
  "seo": {
    "meta_title": "Titre SEO optimise (50-60 caracteres, inclut ville et activite)",
    "meta_description": "Meta description SEO (140-155 caracteres, inclut zone geo et activite principale)"
  },
  "footer": {
    "tagline": "Court slogan de pied de page (5-8 mots)"
  }
}

Important :
- Si des services sont fournis, utilise-les. Sinon, invente 4-6 services typiques pour cette activite.
- Le contenu SEO doit cibler la ville et l'activite pour le referencement local.
- Pas d'emojis, pas de majuscules excessives.
- Les icones doivent etre des noms valides de lucide-react.`;

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
        max_tokens: 2000,
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
