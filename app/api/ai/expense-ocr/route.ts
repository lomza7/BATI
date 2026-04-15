import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { expenseOcrSchema } from '@/lib/ai/expense-ocr-schema';
import { trackAiUsage } from '@/lib/ai-usage';
import { consumeAi } from '@/lib/credits';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';

async function loadOpenAiKey(): Promise<string> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data } = await sb
    .from('platform_secrets')
    .select('key, value')
    .eq('key', 'openai_api_key')
    .maybeSingle();
  return data?.value || process.env.OPENAI_API_KEY || '';
}

const SYSTEM_PROMPT = `Tu es un expert-comptable spécialisé dans la lecture de factures et tickets pour artisans du BTP en France.

On te donne soit une image (photo/scan) soit le texte brut d'un PDF d'une facture ou d'un ticket d'achat. Tu dois extraire les informations comptables suivantes et répondre UNIQUEMENT avec un JSON valide.

RÈGLES :
- Les montants sont en euros (€). Renvoie des nombres (pas de chaînes), avec point décimal.
- Date au format ISO YYYY-MM-DD.
- Si une info n'est pas visible, mets "" pour les chaînes ou 0 pour les nombres.
- TVA française : taux possibles 0, 2.1, 5.5, 10, 20. Pour le BTP : 5.5% (rénovation énergétique), 10% (rénovation logement), 20% (neuf et standard).
- Si une mention "Autoliquidation TVA" / "TVA due par le preneur" apparaît, mets is_autoliquidation à true et tva_total à 0.
- tva_breakdown : si plusieurs taux apparaissent, liste-les. Sinon mets une seule entrée avec le taux principal.
- Vérifie la cohérence : amount_ht + tva_total ≈ amount_ttc (tolérance 0.02€).
- category_slug : choisis parmi cette liste BTP exacte selon la nature de l'achat :
  * "materiaux" — matériaux de construction (bois, ciment, plâtre, peinture, etc.)
  * "outillage" — outillage et petit équipement
  * "sous_traitance" — prestations de sous-traitants
  * "carburant" — essence, gasoil, GNR
  * "vehicule" — entretien, pièces auto, garage
  * "assurances" — primes d'assurance
  * "telephone" — abonnements téléphone, internet
  * "loyer" — loyer du local, charges
  * "fournitures" — fournitures de bureau, papeterie
  * "banque" — frais bancaires, agios
  * "honoraires" — comptable, avocat, conseil
  * "formation" — formations, stages
  * "autres" — par défaut si rien ne correspond
- payment_method : "cb" | "virement" | "especes" | "cheque" | "prelevement" | "autre" | null si non visible.
- confidence : ta confiance globale sur l'extraction, entre 0 et 1.

IMPORTANT — LIGNES DÉTAILLÉES :
- Extrais CHAQUE article/ligne du ticket séparément dans le tableau "lines".
- Chaque ligne a : description, quantity, unit_price_ht, amount_ht, tva_rate, category_slug.
- Les champs globaux (amount_ht, amount_ttc, tva_total) sont les TOTAUX du ticket.
- "description" global = résumé court du ticket (ex: "Matériaux chantier Leroy Merlin").

FORMAT DE RÉPONSE (JSON pur) :
{
  "supplier": "Leroy Merlin",
  "supplier_siret": "384 560 942 12345",
  "invoice_number": "FA-2026-001234",
  "date": "2026-04-08",
  "description": "Matériaux chantier",
  "amount_ht": 245.50,
  "amount_ttc": 294.60,
  "tva_total": 49.10,
  "tva_breakdown": [{ "rate": 20, "ht": 245.50, "tva": 49.10 }],
  "is_autoliquidation": false,
  "payment_method": "cb",
  "category_slug": "materiaux",
  "confidence": 0.92,
  "lines": [
    { "description": "Parpaing 20x20x50", "quantity": 50, "unit_price_ht": 1.20, "amount_ht": 60.00, "tva_rate": 20, "category_slug": "materiaux" },
    { "description": "Sac ciment 35kg", "quantity": 10, "unit_price_ht": 5.50, "amount_ht": 55.00, "tva_rate": 20, "category_slug": "materiaux" },
    { "description": "Fer à béton 8mm", "quantity": 20, "unit_price_ht": 6.53, "amount_ht": 130.50, "tva_rate": 20, "category_slug": "materiaux" }
  ]
}`;

function extractJsonFromText(content: string): string {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Aucune réponse JSON exploitable');
  }
  return content.slice(start, end + 1);
}

export async function POST(request: Request) {
  try {
    const apiKey = await loadOpenAiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API OpenAI manquante' }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '').trim();

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Burst protection
    const rl = checkRateLimit(`ai-expense-ocr:${user.id}`, 15, 60_000);
    if (!rl.ok) return rateLimitResponse(rl);

    const gate = await consumeAi(user.id, 'accounting_ai');
    if (!gate.ok) {
      if (gate.reason === 'no_pro_access') {
        return NextResponse.json({ error: 'Abonnement Pro requis.' }, { status: 403 });
      }
      return NextResponse.json(
        { error: 'Cr\u00e9dits IA insuffisants.', balance: gate.balance, required: gate.required },
        { status: 402 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Formulaire invalide' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 });
    }

    const mime = (file.type || '').toLowerCase();
    const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isHeic = mime === 'image/heic' || mime === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
    const isImage = mime.startsWith('image/') || isHeic;

    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'Format non supporté (image ou PDF uniquement)' }, { status: 400 });
    }

    if (isHeic) {
      return NextResponse.json(
        { error: 'Format HEIC non supporté. Veuillez réessayer ou aller dans Réglages → Appareil photo → Formats → Le plus compatible.' },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    // Build OpenAI messages
    const userContent: any[] = [];

    if (isPdf) {
      try {
        const { extractPdfText } = await import('@/lib/ai/pdf-extract');
        const { text, pageCount } = await extractPdfText(buffer);
        if (!text.trim()) {
          return NextResponse.json(
            { error: 'PDF illisible (probablement scanné). Photographiez plutôt la facture.' },
            { status: 422 },
          );
        }
        userContent.push({
          type: 'text',
          text: `Voici le texte extrait d'un PDF de facture (${pageCount} page${pageCount > 1 ? 's' : ''}). Analyse-le et renvoie le JSON :\n\n${text}`,
        });
      } catch (e) {
        console.error('[expense-ocr] PDF extraction failed:', e);
        return NextResponse.json(
          { error: 'Impossible de lire le PDF, photographiez plutôt la facture.' },
          { status: 422 },
        );
      }
    } else {
      const base64 = buffer.toString('base64');
      const mediaType = mime === 'image/png' ? 'image/png' : mime === 'image/webp' ? 'image/webp' : 'image/jpeg';
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${mediaType};base64,${base64}` },
      });
      userContent.push({
        type: 'text',
        text: 'Voici la facture à analyser. Renvoie uniquement le JSON.',
      });
    }

    const model = process.env.OPENAI_VISION_MODEL || DEFAULT_MODEL;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[expense-ocr] OpenAI ${response.status}:`, err);
      await trackAiUsage({ user_id: user.id, route: 'ai/expense-ocr', status: 'error' });

      let detail = '';
      try {
        const parsed = JSON.parse(err);
        detail = parsed?.error?.message || '';
      } catch { /* not JSON */ }

      return NextResponse.json(
        { error: detail || `Erreur IA (${response.status}). Réessayez.` },
        { status: 502 },
      );
    }

    const responseJson = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const rawText = responseJson.choices?.[0]?.message?.content || '';
    const inputTokens = responseJson.usage?.prompt_tokens || 0;
    const outputTokens = responseJson.usage?.completion_tokens || 0;

    let extracted;
    try {
      const jsonStr = extractJsonFromText(rawText);
      const parsed = JSON.parse(jsonStr);
      extracted = expenseOcrSchema.parse(parsed);
    } catch (e) {
      await trackAiUsage({
        user_id: user.id,
        route: 'ai/expense-ocr',
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        status: 'error',
      });
      console.error('[expense-ocr] Parse failed:', e, 'raw:', rawText.slice(0, 300));
      return NextResponse.json(
        { error: 'Réponse IA inexploitable, réessayez.' },
        { status: 422 },
      );
    }

    await trackAiUsage({
      user_id: user.id,
      route: 'ai/expense-ocr',
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });

    // Upload receipt to storage
    let receiptStoragePath: string | null = null;
    try {
      const { data: membership } = await supabaseAdmin
        .from('workspace_memberships')
        .select('owner_user_id')
        .eq('member_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      const ownerUserId = membership?.owner_user_id || user.id;

      const yyyy = new Date().getFullYear();
      const ext = isPdf ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const rand = Math.random().toString(36).slice(2, 10);
      const filePath = `${ownerUserId}/${yyyy}/${Date.now()}-${rand}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('receipts')
        .upload(filePath, buffer, {
          contentType: isPdf ? 'application/pdf' : mime,
          upsert: false,
        });

      if (!uploadError) {
        receiptStoragePath = filePath;
      } else {
        console.error('Receipt upload failed:', uploadError.message);
      }
    } catch (e) {
      console.error('Receipt upload threw:', e);
    }

    return NextResponse.json({
      extracted,
      receipt_storage_path: receiptStoragePath,
      tokens_used: inputTokens + outputTokens,
    });
  } catch (topError) {
    console.error('[expense-ocr] Unhandled error:', topError);
    return NextResponse.json(
      { error: topError instanceof Error ? topError.message : 'Erreur serveur inattendue' },
      { status: 500 },
    );
  }
}
