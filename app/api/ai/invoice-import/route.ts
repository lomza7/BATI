import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { invoiceImportItemSchema, type InvoiceImportItem } from '@/lib/ai/invoice-import-schema';
import { extractPdfText } from '@/lib/ai/pdf-extract';
import { trackAiUsage } from '@/lib/ai-usage';
import { consumeAi } from '@/lib/credits';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';
import { callOpenAI, OpenAIError, DEFAULT_OPENAI_MODEL, type AnthropicMessage } from '@/lib/ai/openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT_PDF = `Tu es un expert en lecture de factures pour artisans du BTP en France.

On te donne soit une image (photo/scan) soit le texte brut d'un PDF d'une facture ÉMISE par un artisan à son client. C'est une facture SORTANTE : l'artisan est l'émetteur, le client est le destinataire.

Tu dois extraire les informations suivantes et répondre UNIQUEMENT avec un JSON valide (sans markdown, sans explication) :

- client_name : nom du client destinataire de la facture (PAS le nom de l'artisan/émetteur)
- client_address : adresse complète du client ou du chantier (si l'adresse du chantier est distincte, privilégie-la)
- client_city : ville
- client_postal_code : code postal (5 chiffres)
- invoice_date : date de la facture au format YYYY-MM-DD
- invoice_number : numéro de facture tel qu'il apparaît sur le document
- description : description courte des travaux réalisés (1-2 phrases)
- amount_ht : montant HT en euros (nombre avec point décimal)
- amount_ttc : montant TTC en euros (nombre avec point décimal)
- tva_rate : taux de TVA principal (5.5, 10, ou 20)
- confidence : ta confiance globale sur l'extraction, entre 0 et 1

RÈGLES :
- Les montants sont en euros. Renvoie des nombres, pas de chaînes.
- Si une info n'est pas visible, mets "" pour les chaînes ou 0 pour les nombres.
- Attention : l'émetteur/fournisseur est l'artisan, PAS le client. Le client est le destinataire.
- Cherche les sections "Client", "Destinataire", "Facturé à", "Adresse du chantier", "Livré à".
- Si l'adresse du chantier est distincte de l'adresse du client, privilégie l'adresse du chantier.
- Vérifie la cohérence : amount_ht + TVA ≈ amount_ttc.

FORMAT DE RÉPONSE (JSON pur, sans \`\`\`) :
{
  "client_name": "M. Dupont",
  "client_address": "12 rue de la Paix",
  "client_city": "Lyon",
  "client_postal_code": "69001",
  "invoice_date": "2025-11-15",
  "invoice_number": "F-2025-042",
  "description": "Rénovation complète salle de bain avec pose carrelage et plomberie",
  "amount_ht": 4500.00,
  "amount_ttc": 4950.00,
  "tva_rate": 10,
  "confidence": 0.92
}`;

const SYSTEM_PROMPT_CSV = `Tu es un expert en lecture de données tabulaires pour artisans du BTP en France.

On te donne le contenu brut d'un fichier CSV contenant des factures ÉMISES par un artisan à ses clients. Chaque ligne représente une facture sortante.

Tu dois identifier les colonnes et extraire pour CHAQUE LIGNE un objet JSON avec les champs suivants :
- client_name : nom du client destinataire
- client_address : adresse complète du client ou du chantier
- client_city : ville
- client_postal_code : code postal (5 chiffres)
- invoice_date : date de la facture au format YYYY-MM-DD
- invoice_number : numéro de facture
- description : description courte des travaux
- amount_ht : montant HT en euros (nombre)
- amount_ttc : montant TTC en euros (nombre)
- tva_rate : taux de TVA principal (5.5, 10, ou 20)
- confidence : ta confiance sur l'extraction de cette ligne, entre 0 et 1

RÈGLES :
- Renvoie un TABLEAU JSON (array), un objet par ligne de facture.
- Ignore les lignes d'en-tête, les lignes vides et les totaux.
- Si une colonne n'existe pas dans le CSV, mets "" ou 0 par défaut.
- Les dates françaises (JJ/MM/AAAA) doivent être converties en YYYY-MM-DD.
- Les montants avec virgule (1 234,50) doivent être convertis en nombre avec point (1234.50).
- Renvoie UNIQUEMENT le JSON (sans markdown, sans explication).

FORMAT DE RÉPONSE (JSON pur) :
[
  { "client_name": "M. Dupont", "client_address": "12 rue de la Paix", ... },
  { "client_name": "Mme Bernard", "client_address": "5 avenue des Lilas", ... }
]`;

function extractJsonFromText(content: string): string {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const startBracket = content.indexOf('[');
  const startBrace = content.indexOf('{');
  let start: number;
  if (startBracket === -1) start = startBrace;
  else if (startBrace === -1) start = startBracket;
  else start = Math.min(startBracket, startBrace);
  const isArray = start === startBracket;
  const end = isArray ? content.lastIndexOf(']') : content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Aucune réponse JSON exploitable');
  }
  return content.slice(start, end + 1);
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 503 });
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

  const rl = checkRateLimit(`ai-invoice-import:${user.id}`, 30, 60_000);
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
  const fileName = file.name.toLowerCase();
  const isPdf = mime === 'application/pdf' || fileName.endsWith('.pdf');
  const isCsv = mime === 'text/csv' || mime === 'application/vnd.ms-excel' || fileName.endsWith('.csv');
  const isImage = mime.startsWith('image/');

  if (mime === 'image/heic' || mime === 'image/heif' || fileName.match(/\.(heic|heif)$/)) {
    return NextResponse.json(
      { error: 'Format HEIC non supporté. Convertissez en JPEG avant d\'importer.' },
      { status: 400 },
    );
  }

  if (!isPdf && !isCsv && !isImage) {
    return NextResponse.json({ error: 'Format non supporté (PDF, CSV ou image uniquement)' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

  const userContent: ContentBlock[] = [];
  let systemPrompt: string;

  if (isCsv) {
    const csvText = buffer.toString('utf-8');
    if (!csvText.trim()) {
      return NextResponse.json({ error: 'Fichier CSV vide' }, { status: 400 });
    }
    systemPrompt = SYSTEM_PROMPT_CSV;
    userContent.push({
      type: 'text',
      text: `Voici le contenu d'un fichier CSV de factures. Analyse chaque ligne et renvoie le tableau JSON :\n\n${csvText}`,
    });
  } else if (isPdf) {
    systemPrompt = SYSTEM_PROMPT_PDF;
    try {
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
        context: { route: 'ai/invoice-import', step: 'pdf_extract', user_id: user.id },
      });
    }
  } else {
    systemPrompt = SYSTEM_PROMPT_PDF;
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

  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  try {
    const message: AnthropicMessage = { role: 'user', content: userContent };
    const data = await callOpenAI({
      max_tokens: isCsv ? 4000 : 1500,
      temperature: 0,
      system: systemPrompt,
      messages: [message],
    });

    const rawText = data.content?.[0]?.text || '';

    let extracted: InvoiceImportItem[];
    try {
      const jsonStr = extractJsonFromText(rawText);
      const parsed = JSON.parse(jsonStr);

      if (Array.isArray(parsed)) {
        extracted = [];
        for (let i = 0; i < parsed.length; i++) {
          extracted.push(invoiceImportItemSchema.parse(parsed[i]));
        }
      } else {
        extracted = [invoiceImportItemSchema.parse(parsed)];
      }
    } catch (e) {
      await trackAiUsage({
        user_id: user.id,
        route: 'ai/invoice-import',
        model,
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
        status: 'error',
      });
      return apiError('AI_PARSE', {
        cause: e,
        context: { route: 'ai/invoice-import', user_id: user.id, raw_preview: rawText.slice(0, 200) },
      });
    }

    await trackAiUsage({
      user_id: user.id,
      route: 'ai/invoice-import',
      model,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    });

    return NextResponse.json({
      extracted,
      tokens_used: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    });
  } catch (error) {
    if (error instanceof OpenAIError) {
      await trackAiUsage({ user_id: user.id, route: 'ai/invoice-import', status: 'error' });
      return apiError('AI_FAILED', {
        cause: error.body,
        context: { route: 'ai/invoice-import', user_id: user.id, status: error.status },
      });
    }
    return apiError('INTERNAL', {
      cause: error,
      context: { route: 'ai/invoice-import', user_id: user.id },
    });
  }
}
