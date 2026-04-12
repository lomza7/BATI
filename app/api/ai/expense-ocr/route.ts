import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { expenseOcrSchema } from '@/lib/ai/expense-ocr-schema';
import { checkAiLimit, trackAiUsage } from '@/lib/ai-usage';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `Tu es un expert-comptable spécialisé dans la lecture de factures et tickets pour artisans du BTP en France.

On te donne soit une image (photo/scan) soit le texte brut d'un PDF d'une facture ou d'un ticket d'achat. Tu dois extraire les informations comptables suivantes et répondre UNIQUEMENT avec un JSON valide (sans markdown, sans explication).

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

FORMAT DE RÉPONSE (JSON pur, sans \`\`\`) :
{
  "supplier": "Leroy Merlin",
  "supplier_siret": "384 560 942 12345",
  "invoice_number": "FA-2026-001234",
  "date": "2026-04-08",
  "description": "Achat matériaux placo",
  "amount_ht": 245.50,
  "amount_ttc": 294.60,
  "tva_total": 49.10,
  "tva_breakdown": [{ "rate": 20, "ht": 245.50, "tva": 49.10 }],
  "is_autoliquidation": false,
  "payment_method": "cb",
  "category_slug": "materiaux",
  "confidence": 0.92
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY manquante' }, { status: 503 });
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

  // Burst protection (sliding window) — per-user, expense-ocr is expensive (Claude vision)
  const rl = checkRateLimit(`ai-expense-ocr:${user.id}`, 15, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const limitCheck = await checkAiLimit(user.id);
  if (!limitCheck.allowed) {
    return NextResponse.json({ error: limitCheck.reason }, { status: 429 });
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

  // HEIC should have been converted client-side, reject if it wasn't
  if (isHeic) {
    return NextResponse.json(
      { error: 'Format HEIC non supporté. Veuillez réessayer ou aller dans Réglages → Appareil photo → Formats → Le plus compatible.' },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(new Uint8Array(arrayBuffer));

  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

  const userContent: ContentBlock[] = [];

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
      return apiError('AI_PARSE', {
        message: 'Impossible de lire le PDF, photographiez plutôt la facture.',
        cause: e,
        context: { route: 'ai/expense-ocr', step: 'pdf_extract', user_id: user.id },
      });
    }
  } else {
    const base64 = buffer.toString('base64');
    const mediaType = mime === 'image/png' ? 'image/png' : mime === 'image/webp' ? 'image/webp' : 'image/jpeg';
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    });
    userContent.push({
      type: 'text',
      text: 'Voici la facture à analyser. Renvoie uniquement le JSON.',
    });
  }

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
        max_tokens: 1500,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[expense-ocr] Anthropic ${response.status}:`, err);
      await trackAiUsage({ user_id: user.id, route: 'ai/expense-ocr', status: 'error' });

      // Parse Anthropic error for a user-readable message
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

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const rawText = data.content?.[0]?.text || '';

    let extracted;
    try {
      const jsonStr = extractJsonFromText(rawText);
      const parsed = JSON.parse(jsonStr);
      extracted = expenseOcrSchema.parse(parsed);
    } catch (e) {
      await trackAiUsage({
        user_id: user.id,
        route: 'ai/expense-ocr',
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
        status: 'error',
      });
      return apiError('AI_PARSE', {
        cause: e,
        context: { route: 'ai/expense-ocr', user_id: user.id, raw_preview: rawText.slice(0, 200) },
      });
    }

    await trackAiUsage({
      user_id: user.id,
      route: 'ai/expense-ocr',
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    });

    // Upload the receipt to the receipts bucket so it stays attached.
    // Resolve workspace owner so the path matches storage RLS.
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
      const ext = isPdf
        ? 'pdf'
        : mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
        ? 'webp'
        : 'jpg';
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
      tokens_used: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    });
  } catch (error) {
    return apiError('INTERNAL', {
      cause: error,
      context: { route: 'ai/expense-ocr', user_id: user.id },
    });
  }

  } catch (topError) {
    // Global catch — ensures we always return JSON, never Vercel's HTML 500 page
    console.error('[expense-ocr] Unhandled error:', topError);
    return NextResponse.json(
      { error: topError instanceof Error ? topError.message : 'Erreur serveur inattendue' },
      { status: 500 },
    );
  }
}
