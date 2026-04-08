// POST /api/comptabilite/bank/transactions/[id]/create-expense
// Crée une dépense pré-remplie depuis une transaction bancaire orpheline (débit),
// puis matche automatiquement les deux.
// Note : la dépense créée n'a PAS de justificatif — l'utilisateur devra l'ajouter ensuite
// depuis l'onglet Dépenses (la règle "justificatif obligatoire" ne s'applique pas ici car
// c'est une création depuis le relevé bancaire, on ne peut pas bloquer le rapprochement).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { applyMatch } from '@/lib/comptabilite/reconciliation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: {
    supplier?: string;
    description?: string;
    expense_category_id?: string | null;
    project_id?: string | null;
    tva_rate?: number;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Charge la transaction et vérifie l'accès via RLS
  const { data: tx } = await sb
    .from('bank_transactions')
    .select('id, user_id, transaction_date, label, amount, direction, matched_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!tx) {
    return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 });
  }
  if (tx.direction !== 'debit') {
    return NextResponse.json(
      { error: 'On ne peut créer une dépense que depuis un débit bancaire' },
      { status: 400 },
    );
  }
  if (tx.matched_at) {
    return NextResponse.json(
      { error: 'Cette transaction est déjà rapprochée' },
      { status: 409 },
    );
  }

  const amountTtc = Math.abs(Number(tx.amount));
  const tvaRate = typeof body.tva_rate === 'number' ? body.tva_rate : 20;
  const amountHt = +(amountTtc / (1 + tvaRate / 100)).toFixed(2);
  const tvaAmount = +(amountTtc - amountHt).toFixed(2);

  const supplier = (body.supplier || '').trim() || extractSupplierFromLabel(tx.label) || 'Inconnu';
  const description =
    (body.description || '').trim() || `Créé depuis relevé bancaire — ${tx.label}`.slice(0, 200);

  // Récupère la catégorie "autres" par défaut si non précisée
  let categoryId = body.expense_category_id || null;
  let categorySlug = 'autres';
  if (categoryId) {
    const { data: cat } = await supabaseAdmin
      .from('expense_categories')
      .select('slug')
      .eq('id', categoryId)
      .maybeSingle();
    if (cat?.slug) categorySlug = cat.slug;
  } else {
    const { data: defaultCat } = await supabaseAdmin
      .from('expense_categories')
      .select('id, slug')
      .eq('user_id', tx.user_id)
      .eq('slug', 'autres')
      .maybeSingle();
    if (defaultCat) {
      categoryId = defaultCat.id;
      categorySlug = defaultCat.slug;
    }
  }

  const { data: expense, error: expErr } = await supabaseAdmin
    .from('expenses')
    .insert({
      user_id: tx.user_id,
      description,
      supplier,
      date: tx.transaction_date,
      amount_ht: amountHt,
      tva_rate: tvaRate,
      tva_amount: tvaAmount,
      amount: amountTtc,
      expense_category_id: categoryId,
      project_id: body.project_id || null,
      source: 'manual',
      category: categorySlug,
    })
    .select('*')
    .single();

  if (expErr || !expense) {
    return NextResponse.json(
      { error: expErr?.message || 'Création de la dépense impossible' },
      { status: 500 },
    );
  }

  // Match automatique
  try {
    await applyMatch(supabaseAdmin, params.id, 'expense', expense.id, 'manual', 1.0);
  } catch (e) {
    console.error('Match after create-expense failed:', e);
  }

  return NextResponse.json({ expense, ok: true });
}

function extractSupplierFromLabel(label: string): string {
  // Heuristique simple : prend le premier mot "significatif"
  // après les abréviations bancaires courantes
  const cleaned = label
    .replace(/\b(VIR|VRT|PRLV|CB|CHQ|VIREMENT|PRELEVEMENT|CARTE|RETRAIT)\s*/gi, '')
    .replace(/\b\d{4,}\b/g, '') // retire les longs nombres
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter((w) => w.length > 2);
  return words.slice(0, 3).join(' ').slice(0, 80);
}
