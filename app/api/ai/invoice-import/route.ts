import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  invoiceImportItemSchema,
  normalizeInvoiceImportItem,
  type InvoiceImportItem,
} from '@/lib/ai/invoice-import-schema';
import { extractPdfText } from '@/lib/ai/pdf-extract';
import { trackAiUsage } from '@/lib/ai-usage';
import { consumeAi } from '@/lib/credits';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';
import { callOpenAI, OpenAIError, DEFAULT_OPENAI_MODEL, type AnthropicMessage } from '@/lib/ai/openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT_PDF = `Tu es un expert en lecture de factures pour artisans du BTP en France.

On te donne soit une image (photo/scan) soit le texte brut d'un PDF d'un document ÉMIS par un artisan à son client. C'est un document SORTANT : l'artisan est l'émetteur, le client est le destinataire.

Ce document est soit une FACTURE, soit un AVOIR (aussi appelé note de crédit ou facture rectificative). Un avoir est une facture rectificative qui annule ou réduit tout ou partie d'une facture déjà émise : c'est de l'argent rendu au client, pas de l'argent dû par lui.

Tu dois extraire les informations suivantes et répondre UNIQUEMENT avec un JSON valide (sans markdown, sans explication) :

- document_type : "facture" ou "avoir"
- client_name : nom du client destinataire du document (PAS le nom de l'artisan/émetteur)
- client_address : adresse complète du client ou du chantier (si l'adresse du chantier est distincte, privilégie-la)
- client_city : ville
- client_postal_code : code postal (5 chiffres)
- invoice_date : date du document au format YYYY-MM-DD
- invoice_number : numéro du document tel qu'il apparaît (numéro de facture, ou numéro d'avoir)
- credited_invoice_number : UNIQUEMENT pour un avoir — numéro de la facture rectifiée, tel qu'il apparaît sur l'avoir. "" pour une facture, ou si l'avoir ne le mentionne pas.
- description : description courte des travaux réalisés ou du motif de l'avoir (1-2 phrases)
- amount_ht : montant HT en euros (nombre avec point décimal)
- amount_ttc : montant TTC en euros (nombre avec point décimal)
- tva_rate : taux de TVA principal (5.5, 10, ou 20)
- confidence : ta confiance globale sur l'extraction, entre 0 et 1

DÉTECTION D'UN AVOIR — mets document_type = "avoir" dès qu'un de ces signes est présent :
- le document est intitulé "Avoir", "Note de crédit", "Facture rectificative", "Facture d'avoir", "Credit note" ;
- son numéro commence par AV, AVO, AV- ou NC ;
- les montants sont affichés en négatif, entre parenthèses, ou précédés d'un signe moins ;
- le document annonce un remboursement, un geste commercial, une annulation de commande, un retour de matériel, ou "à déduire de votre facture n°…", "en votre faveur", "à votre crédit".

RÈGLES :
- Les montants sont en euros. Renvoie des nombres, pas de chaînes.
- Pour un AVOIR, renvoie les montants en NÉGATIF (exemple : -1200.00). Pour une facture, en positif.
- Si une info n'est pas visible, mets "" pour les chaînes ou 0 pour les nombres.
- Attention : l'émetteur/fournisseur est l'artisan, PAS le client. Le client est le destinataire.
- Cherche les sections "Client", "Destinataire", "Facturé à", "Adresse du chantier", "Livré à".
- Si l'adresse du chantier est distincte de l'adresse du client, privilégie l'adresse du chantier.
- Sur un avoir, cherche la référence à la facture initiale : "Avoir sur facture n°…", "Annule et remplace la facture…", "Rectifie la facture…", "Facture d'origine".
- Vérifie la cohérence : amount_ht + TVA ≈ amount_ttc (les deux de même signe).

FORMAT DE RÉPONSE (JSON pur, sans \`\`\`) :
{
  "document_type": "facture",
  "client_name": "M. Dupont",
  "client_address": "12 rue de la Paix",
  "client_city": "Lyon",
  "client_postal_code": "69001",
  "invoice_date": "2025-11-15",
  "invoice_number": "F-2025-042",
  "credited_invoice_number": "",
  "description": "Rénovation complète salle de bain avec pose carrelage et plomberie",
  "amount_ht": 4500.00,
  "amount_ttc": 4950.00,
  "tva_rate": 10,
  "confidence": 0.92
}

EXEMPLE D'AVOIR :
{
  "document_type": "avoir",
  "client_name": "M. Dupont",
  "client_address": "12 rue de la Paix",
  "client_city": "Lyon",
  "client_postal_code": "69001",
  "invoice_date": "2025-12-03",
  "invoice_number": "AV-2025-007",
  "credited_invoice_number": "F-2025-042",
  "description": "Geste commercial sur la pose de carrelage",
  "amount_ht": -500.00,
  "amount_ttc": -550.00,
  "tva_rate": 10,
  "confidence": 0.9
}`;

const SYSTEM_PROMPT_CSV = `Tu es un expert en lecture de données tabulaires pour artisans du BTP en France.

On te donne le contenu brut d'un fichier CSV contenant des documents ÉMIS par un artisan à ses clients. Chaque ligne représente soit une facture sortante, soit un AVOIR (note de crédit / facture rectificative), c'est-à-dire un montant rendu au client sur une facture déjà émise.

Tu dois identifier les colonnes et extraire pour CHAQUE LIGNE un objet JSON avec les champs suivants :
- document_type : "facture" ou "avoir"
- client_name : nom du client destinataire
- client_address : adresse complète du client ou du chantier
- client_city : ville
- client_postal_code : code postal (5 chiffres)
- invoice_date : date du document au format YYYY-MM-DD
- invoice_number : numéro du document (facture ou avoir)
- credited_invoice_number : UNIQUEMENT pour un avoir — numéro de la facture rectifiée. "" sinon.
- description : description courte des travaux, ou motif de l'avoir
- amount_ht : montant HT en euros (nombre)
- amount_ttc : montant TTC en euros (nombre)
- tva_rate : taux de TVA principal (5.5, 10, ou 20)
- confidence : ta confiance sur l'extraction de cette ligne, entre 0 et 1

DÉTECTION D'UN AVOIR — mets document_type = "avoir" dès qu'un de ces signes est présent sur la ligne :
- une colonne de type/nature vaut "avoir", "note de crédit", "facture rectificative", "credit note" ;
- le numéro commence par AV, AVO, AV- ou NC ;
- les montants sont négatifs, ou entre parenthèses (comptabilité anglo-saxonne : (1 200,00) vaut -1200.00) ;
- le libellé mentionne un remboursement, un geste commercial, une annulation, un retour, ou "avoir sur facture n°…".

RÈGLES :
- Renvoie un TABLEAU JSON (array), un objet par ligne de document.
- Ignore les lignes d'en-tête, les lignes vides et les totaux.
- Si une colonne n'existe pas dans le CSV, mets "" ou 0 par défaut.
- Les dates françaises (JJ/MM/AAAA) doivent être converties en YYYY-MM-DD.
- Les montants avec virgule (1 234,50) doivent être convertis en nombre avec point (1234.50).
- Pour un AVOIR, renvoie les montants en NÉGATIF (exemple : -1200.00). Pour une facture, en positif.
- Si une colonne porte la référence de la facture d'origine (facture rectifiée, facture liée, "avoir sur"), reporte-la dans credited_invoice_number pour les lignes d'avoir.
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

      // `normalizeInvoiceImportItem` tranche le type de document et aligne le
      // signe des montants dessus : un avoir ressort toujours en negatif, une
      // facture toujours en positif, quelle que soit la forme exacte renvoyee
      // par le modele.
      if (Array.isArray(parsed)) {
        extracted = [];
        for (let i = 0; i < parsed.length; i++) {
          extracted.push(normalizeInvoiceImportItem(invoiceImportItemSchema.parse(parsed[i])));
        }
      } else {
        extracted = [normalizeInvoiceImportItem(invoiceImportItemSchema.parse(parsed))];
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
