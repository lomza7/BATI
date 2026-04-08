// Passe IA pour suggérer le rapprochement des transactions bancaires orphelines
// Lance Claude avec :
//   - Les transactions non rapprochées du relevé
//   - Les dépenses + factures candidates de la même fenêtre de dates (non encore liées)
// Claude renvoie des matches avec un score de confiance.
// Les matches confidence >= 0.7 sont retournés au client pour validation manuelle (pas d'auto-apply).

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { bankReconcileResponseSchema } from '@/lib/ai/bank-reconcile-schema';
import { checkAiLimit, trackAiUsage } from '@/lib/ai-usage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `Tu es un comptable expert pour artisans du BTP en France. On te donne :
- Une liste de transactions bancaires orphelines (libellé brut, date, montant signé)
- Une liste de dépenses candidates (avec fournisseur, description, date, montant TTC)
- Une liste de factures candidates (avec numéro, client, date, montant TTC)

Tu dois associer chaque transaction à AU PLUS un candidat (dépense OU facture), avec un score de confiance entre 0 et 1.

RÈGLES :
- Une transaction "debit" (négatif) → cherche une dépense
- Une transaction "credit" (positif) → cherche une facture
- Le montant doit correspondre exactement (tolérance 0.01€)
- Lis les libellés bancaires : "VIR SEPA DUPONT FACT-2024-12" → relie à la facture F-2024-12 du client Dupont, "PRLV LEROY MERLIN" → relie à une dépense Leroy Merlin
- Les abréviations bancaires courantes : VIR (virement), PRLV (prélèvement), CB (carte), CHQ (chèque), VRT (versement)
- Si plusieurs candidats matchent, choisis le plus probable et baisse la confidence
- Si aucun candidat ne matche raisonnablement, mets kind=null et target_id=null avec confidence 0
- Confidence > 0.85 = très probable, 0.7-0.85 = probable, 0.5-0.7 = incertain, < 0.5 = peu probable

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas d'explication) au format :
{
  "matches": [
    {
      "transaction_id": "uuid",
      "kind": "expense" | "invoice" | null,
      "target_id": "uuid" | null,
      "confidence": 0.92,
      "reasoning": "Le libellé contient 'LEROY MERLIN' et le montant 245.50€ correspond"
    }
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

interface RequestBody {
  statement_id?: string;
  transaction_ids?: string[];
}

export async function POST(request: Request) {
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

  const limitCheck = await checkAiLimit(user.id);
  if (!limitCheck.allowed) {
    return NextResponse.json({ error: limitCheck.reason }, { status: 429 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  // Charge les transactions orphelines (RLS s'assure qu'elles appartiennent au workspace)
  let txQuery = userClient
    .from('bank_transactions')
    .select('id, transaction_date, label, amount, direction')
    .is('matched_at', null)
    .eq('ignored', false)
    .limit(50);

  if (body.transaction_ids && body.transaction_ids.length > 0) {
    txQuery = txQuery.in('id', body.transaction_ids);
  } else if (body.statement_id) {
    txQuery = txQuery.eq('statement_id', body.statement_id);
  }

  const { data: txs, error: txErr } = await txQuery;
  if (txErr) {
    return NextResponse.json({ error: txErr.message }, { status: 500 });
  }
  const transactions = txs || [];

  if (transactions.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  // Calcule la fenêtre de dates pour récupérer les candidats
  const dates = transactions.map((t) => t.transaction_date).sort();
  const minDate = shiftDate(dates[0], -10);
  const maxDate = shiftDate(dates[dates.length - 1], 10);

  // Charge les dépenses candidates (non encore liées) dans la fenêtre
  const { data: expenses } = await userClient
    .from('expenses')
    .select('id, supplier, description, date, amount')
    .is('bank_transaction_id', null)
    .gte('date', minDate)
    .lte('date', maxDate)
    .limit(100);

  // Charge les factures candidates (non encore liées)
  const { data: invoices } = await userClient
    .from('invoices')
    .select('id, invoice_number, title, status, total_ttc, paid_at, issued_at, due_date, clients(name)')
    .is('bank_transaction_id', null)
    .limit(100);

  const userPayload = {
    transactions: transactions.map((t) => ({
      id: t.id,
      date: t.transaction_date,
      label: t.label,
      amount: Number(t.amount),
      direction: t.direction,
    })),
    expense_candidates: (expenses || []).map((e) => ({
      id: e.id,
      supplier: e.supplier,
      description: e.description,
      date: e.date,
      amount_ttc: Number(e.amount || 0),
    })),
    invoice_candidates: (invoices || []).map((i) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      title: i.title,
      client: getClientName(i.clients),
      status: i.status,
      total_ttc: Number(i.total_ttc || 0),
      paid_at: i.paid_at,
      issued_at: i.issued_at,
      due_date: i.due_date,
    })),
  };

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
        max_tokens: 4000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Voici les données à analyser :\n\n${JSON.stringify(userPayload, null, 2)}\n\nRéponds avec le JSON des matches.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      await trackAiUsage({ user_id: user.id, route: 'ai/bank-reconcile', status: 'error' });
      return NextResponse.json({ error: `Erreur API IA: ${err}` }, { status: 502 });
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const rawText = data.content?.[0]?.text || '';

    let parsed;
    try {
      const jsonStr = extractJsonFromText(rawText);
      const obj = JSON.parse(jsonStr);
      parsed = bankReconcileResponseSchema.parse(obj);
    } catch (e) {
      await trackAiUsage({
        user_id: user.id,
        route: 'ai/bank-reconcile',
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
        status: 'error',
      });
      return NextResponse.json(
        {
          error: `Impossible d'analyser la réponse IA: ${e instanceof Error ? e.message : 'parse error'}`,
          raw: rawText,
        },
        { status: 422 },
      );
    }

    await trackAiUsage({
      user_id: user.id,
      route: 'ai/bank-reconcile',
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    });

    return NextResponse.json({
      matches: parsed.matches,
      tokens_used: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur IA' },
      { status: 500 },
    );
  }
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getClientName(c: unknown): string {
  if (!c) return '';
  if (Array.isArray(c)) return (c[0] as { name?: string })?.name || '';
  return (c as { name?: string })?.name || '';
}
