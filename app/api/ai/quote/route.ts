import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { aiQuoteAnalysisSchema, AI_QUOTE_UNITS } from '@/lib/ai/quote-schema';
import { checkAiLimit, trackAiUsage } from '@/lib/ai-usage';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';

export const runtime = 'nodejs';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
const MAX_CATALOG_ITEMS = 30;

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
  return data?.value || process.env.OPENAI_API_KEY || '';
}

interface ServiceCatalogItem {
  id?: string;
  name: string;
  description?: string;
  unit?: string;
  unit_price?: number;
  category?: string;
}

interface RecentQuoteLine {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface BusinessContext {
  company_activity?: string;
  company_city?: string;
  naf_label?: string;
}

interface ClientHistoryEntry {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

// Normalize free-form unit strings returned by the LLM to our canonical enum
const UNIT_ALIASES: Record<string, (typeof AI_QUOTE_UNITS)[number]> = {
  'unite': 'u',
  'unité': 'u',
  'heure': 'h',
  'heures': 'h',
  'hour': 'h',
  'hours': 'h',
  'j': 'jour',
  'jours': 'jour',
  'day': 'jour',
  'days': 'jour',
  'm²': 'm2',
  'm2': 'm2',
  'metre carre': 'm2',
  'metres carres': 'm2',
  'mètre carré': 'm2',
  'mètres carrés': 'm2',
  'm³': 'm3',
  'm3': 'm3',
  'metre cube': 'm3',
  'mètre cube': 'm3',
  'metres cubes': 'm3',
  'mètres cubes': 'm3',
  'metre lineaire': 'ml',
  'metres lineaires': 'ml',
  'mètre linéaire': 'ml',
  'mètres linéaires': 'ml',
  'ml': 'ml',
  'kilogramme': 'kg',
  'kilogrammes': 'kg',
  'kg': 'kg',
  'litre': 'l',
  'litres': 'l',
  'l': 'l',
  'tonne': 't',
  'tonnes': 't',
  't': 't',
  'forfait': 'forfait',
  'lot': 'forfait',
};

function normalizeUnit(raw: unknown): (typeof AI_QUOTE_UNITS)[number] {
  if (typeof raw !== 'string') return 'u';
  const cleaned = raw.trim().toLowerCase();
  if ((AI_QUOTE_UNITS as readonly string[]).includes(cleaned)) {
    return cleaned as (typeof AI_QUOTE_UNITS)[number];
  }
  return UNIT_ALIASES[cleaned] ?? 'u';
}

function normalizeAnalysisRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.lines)) {
    obj.lines = obj.lines.map((line) => {
      if (!line || typeof line !== 'object') return line;
      const l = line as Record<string, unknown>;
      return { ...l, unit: normalizeUnit(l.unit) };
    });
  }
  return obj;
}

function extractJsonFromText(content: string) {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Aucune reponse JSON exploitable n a ete trouvee.');
  }

  return content.slice(start, end + 1);
}

// Simple keyword-based pre-filter: keep services whose name/description/category
// share at least one meaningful token with the transcript, plus any service from
// categories that appear in the transcript. Caps at MAX_CATALOG_ITEMS.
function preFilterCatalog(catalog: ServiceCatalogItem[], transcript: string): ServiceCatalogItem[] {
  if (catalog.length <= MAX_CATALOG_ITEMS) return catalog;

  const stopwords = new Set([
    'le','la','les','un','une','des','de','du','a','au','aux','et','ou','ou','en','pour','avec',
    'sans','sur','dans','par','il','elle','on','je','tu','nous','vous','ils','elles','ce','ca','sa',
    'son','ses','mon','ma','mes','ton','ta','tes','notre','votre','leur','est','sont','etre','ete',
    'fait','plus','moins','tres','aussi','donc','car','mais','que','qui','quoi','quand','comment',
    'the','is','of','to','and','at','in','for','on','by','with','an','a',
  ]);

  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));

  const transcriptTokens = new Set(normalize(transcript));

  const scored = catalog.map((svc) => {
    const haystack = normalize(`${svc.name} ${svc.description ?? ''} ${svc.category ?? ''}`);
    let score = 0;
    for (const token of haystack) {
      if (transcriptTokens.has(token)) score += 1;
    }
    return { svc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, MAX_CATALOG_ITEMS).filter((s) => s.score > 0).map((s) => s.svc);

  // If the keyword filter returned nothing, fall back to the first 30 items
  // so the catalog still has a presence in the prompt.
  if (top.length === 0) return catalog.slice(0, MAX_CATALOG_ITEMS);
  return top;
}

export async function POST(request: Request) {
  const apiKey = await loadOpenAiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Cle API OpenAI manquante. Configure-la dans Administration.' },
      { status: 503 }
    );
  }

  // Auth + limit check
  const authHeader = request.headers.get('authorization');
  let userId: string | null = null;
  if (authHeader) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id || null;
  }

  // Burst protection (sliding window) — per-user when authenticated, per-IP otherwise
  const rlKey = userId ? `ai-quote:${userId}` : `ai-quote:ip:${getClientIp(request)}`;
  const rl = checkRateLimit(rlKey, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  if (userId) {
    const limitCheck = await checkAiLimit(userId);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 429 });
    }
  }

  try {
    const formData = await request.formData();
    const transcript = String(formData.get('transcript') || '').trim();
    const servicesCatalogRaw = String(formData.get('services_catalog') || '').trim();
    const businessContextRaw = String(formData.get('business_context') || '').trim();
    const recentLinesRaw = String(formData.get('recent_quote_lines') || '').trim();
    const clientHistoryRaw = String(formData.get('client_history') || '').trim();
    const photoEntries = formData.getAll('photos').filter((value): value is File => value instanceof File);

    if (!transcript) {
      return NextResponse.json({ error: 'La transcription vocale est vide.' }, { status: 400 });
    }

    // Parse contextual JSON payloads safely
    let servicesCatalog: ServiceCatalogItem[] = [];
    if (servicesCatalogRaw) {
      try { servicesCatalog = JSON.parse(servicesCatalogRaw); } catch { servicesCatalog = []; }
    }

    let businessContext: BusinessContext | null = null;
    if (businessContextRaw) {
      try { businessContext = JSON.parse(businessContextRaw); } catch { businessContext = null; }
    }

    let recentLines: RecentQuoteLine[] = [];
    if (recentLinesRaw) {
      try { recentLines = JSON.parse(recentLinesRaw); } catch { recentLines = []; }
    }

    let clientHistory: ClientHistoryEntry[] = [];
    if (clientHistoryRaw) {
      try { clientHistory = JSON.parse(clientHistoryRaw); } catch { clientHistory = []; }
    }

    // Pre-filter catalog if too large
    const filteredCatalog = preFilterCatalog(servicesCatalog, transcript);

    const imageBlocks = await Promise.all(
      photoEntries.map(async (photo) => {
        const arrayBuffer = await photo.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mediaType = photo.type || 'image/jpeg';

        return {
          type: 'image_url' as const,
          image_url: {
            url: `data:${mediaType};base64,${base64}`,
          },
        };
      })
    );

    const prompt = [
      'Tu aides un artisan francais du BTP a preparer un brouillon de devis.',
      'Analyse la transcription vocale et, le cas echeant, les photos du chantier.',
      'Retourne uniquement un JSON valide, sans markdown, sans commentaire, sans texte avant ou apres.',
      'Le JSON doit respecter exactement cette forme:',
      JSON.stringify(
        {
          title: 'string',
          clientName: 'string',
          description: 'string',
          confidence: 85,
          summary: 'string',
          assumptions: ['string'],
          lines: [
            {
              description: 'string',
              quantity: 1,
              unit: 'forfait',
              unit_price: 0,
              service_id: 'uuid-optionnel-si-issu-du-catalogue',
            },
          ],
        },
        null,
        2
      ),
      'Consignes:',
      '- Reponds en francais.',
      '- Le titre doit etre court et exploitable pour un devis.',
      '- clientName peut etre vide si aucun nom n est identifiable.',
      "- description doit resumer le besoin et indiquer qu'il s'agit d'un brouillon IA a valider.",
      '- confidence doit etre un entier de 0 a 100.',
      '- assumptions doit contenir seulement des hypotheses utiles.',
      '- lines doit contenir des lignes concretes de devis avec quantites et prix unitaires plausibles.',
      '- Si un prix est incertain, propose une estimation raisonnable pour un brouillon.',
      `- unit doit etre STRICTEMENT l une de ces valeurs: ${AI_QUOTE_UNITS.join(', ')}. N en invente pas d autres.`,
      ...(businessContext && (businessContext.company_activity || businessContext.naf_label || businessContext.company_city)
        ? [
            '',
            'Profil de l\'artisan:',
            businessContext.company_activity ? `- Activite: ${businessContext.company_activity}` : '',
            businessContext.naf_label ? `- Code NAF: ${businessContext.naf_label}` : '',
            businessContext.company_city ? `- Ville: ${businessContext.company_city}` : '',
            'Adapte les prestations, les ordres de grandeur et les prix au metier et a la zone d intervention de cet artisan.',
            'Si une demande sort clairement de son metier, mentionne le dans assumptions.',
          ].filter(Boolean)
        : []),
      ...(filteredCatalog.length > 0
        ? [
            '',
            'IMPORTANT: L\'artisan a une bibliotheque de prestations avec ses propres prix et descriptions.',
            'Utilise EN PRIORITE ces prestations pour les lignes du devis.',
            'Reprends exactement les noms, descriptions, unites et prix unitaires du catalogue.',
            'Quand tu utilises une prestation du catalogue, renvoie son id dans le champ service_id de la ligne.',
            'Ne modifie les prix que si la transcription mentionne explicitement un tarif different.',
            `Catalogue de prestations: ${JSON.stringify(filteredCatalog)}`,
          ]
        : []),
      ...(recentLines.length > 0
        ? [
            '',
            'Historique recent (prix reellement factures par cet artisan):',
            `${JSON.stringify(recentLines)}`,
            'Ancre tes estimations sur ces prix reels quand la situation est similaire.',
          ]
        : []),
      ...(clientHistory.length > 0
        ? [
            '',
            'Historique avec ce client (devis/factures precedents):',
            `${JSON.stringify(clientHistory)}`,
            'Garde une coherence tarifaire avec les prestations deja facturees a ce client.',
          ]
        : []),
      '',
      `Transcription: ${transcript}`,
      `Nombre de photos: ${photoEntries.length}`,
    ].filter(Boolean).join('\n');

    const model = process.env.OPENAI_VISION_MODEL || DEFAULT_MODEL;

    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              ...imageBlocks,
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      return apiError('AI_FAILED', {
        cause: errorText,
        context: { route: 'ai/quote', user_id: userId, status: openaiResponse.status },
      });
    }

    const responseJson = (await openaiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    // Track usage
    if (userId) {
      trackAiUsage({
        user_id: userId,
        route: 'ai/quote',
        model,
        input_tokens: responseJson.usage?.prompt_tokens || 0,
        output_tokens: responseJson.usage?.completion_tokens || 0,
        status: 'success',
      }).catch(() => {});
    }

    const textContent = responseJson.choices?.[0]?.message?.content?.trim();

    if (!textContent) {
      return NextResponse.json({ error: "La reponse d'OpenAI est vide." }, { status: 502 });
    }

    const rawParsed = JSON.parse(extractJsonFromText(textContent));
    const normalized = normalizeAnalysisRaw(rawParsed);
    const parsed = aiQuoteAnalysisSchema.parse(normalized);

    return NextResponse.json({ analysis: parsed });
  } catch (error) {
    return apiError('INTERNAL', {
      message: "L'analyse IA a echoue.",
      cause: error,
      context: { route: 'ai/quote', user_id: userId },
    });
  }
}
