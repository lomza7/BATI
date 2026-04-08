// POST /api/comptabilite/bank/import
// Reçoit un CSV ou OFX, parse, crée bank_statement + bank_transactions,
// upload le fichier brut dans le bucket "bank-statements", lance le auto-match.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseBankStatement } from '@/lib/comptabilite/bank-parsers';
import { autoMatchTransactions } from '@/lib/comptabilite/reconciliation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

export async function POST(request: NextRequest) {
  try {
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
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Workspace owner pour le storage path
    const { data: membership } = await supabaseAdmin
      .from('workspace_memberships')
      .select('owner_user_id')
      .eq('member_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    const ownerUserId = membership?.owner_user_id || user.id;

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = buffer.toString('utf-8');

    let parsed;
    try {
      parsed = parseBankStatement(file.name, text);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Erreur de lecture du fichier' },
        { status: 422 },
      );
    }

    // Upload le fichier brut dans le bucket
    const yyyy = new Date().getFullYear();
    const ext = parsed.format === 'ofx' ? 'ofx' : 'csv';
    const rand = Math.random().toString(36).slice(2, 10);
    const storagePath = `${ownerUserId}/${yyyy}/${Date.now()}-${rand}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('bank-statements')
      .upload(storagePath, buffer, {
        contentType: parsed.format === 'ofx' ? 'application/x-ofx' : 'text/csv',
        upsert: false,
      });

    if (uploadError) {
      console.error('Bank statement upload failed:', uploadError.message);
    }

    // Crée le bank_statement (via service role pour bypass RLS et garantir le user_id)
    const { data: statement, error: stErr } = await supabaseAdmin
      .from('bank_statements')
      .insert({
        user_id: ownerUserId,
        filename: file.name,
        format: parsed.format,
        bank_name: parsed.bank_name,
        account_iban: parsed.account_iban,
        period_start: parsed.period_start,
        period_end: parsed.period_end,
        opening_balance: parsed.opening_balance,
        closing_balance: parsed.closing_balance,
        transaction_count: parsed.transactions.length,
        storage_path: uploadError ? null : storagePath,
      })
      .select('*')
      .single();

    if (stErr || !statement) {
      return NextResponse.json(
        { error: stErr?.message || 'Création du relevé impossible' },
        { status: 500 },
      );
    }

    // Insère les transactions en bulk (en gérant les doublons fitid)
    const txRows = parsed.transactions.map((t) => ({
      user_id: ownerUserId,
      statement_id: statement.id,
      transaction_date: t.transaction_date,
      value_date: t.value_date,
      label: t.label,
      amount: t.amount,
      direction: t.direction,
      fitid: t.fitid,
    }));

    let insertedCount = 0;
    if (txRows.length > 0) {
      // Si fitid présent, on filtre d'abord les doublons existants pour éviter conflit
      const fitidsToCheck = txRows.map((r) => r.fitid).filter((f): f is string => Boolean(f));
      let existingFitids = new Set<string>();
      if (fitidsToCheck.length > 0) {
        const { data: existing } = await supabaseAdmin
          .from('bank_transactions')
          .select('fitid')
          .eq('user_id', ownerUserId)
          .in('fitid', fitidsToCheck);
        existingFitids = new Set((existing || []).map((r) => r.fitid as string));
      }

      const toInsert = txRows.filter((r) => !r.fitid || !existingFitids.has(r.fitid));
      if (toInsert.length > 0) {
        const { error: insErr } = await supabaseAdmin.from('bank_transactions').insert(toInsert);
        if (insErr) {
          // Rollback : supprime le statement créé
          await supabaseAdmin.from('bank_statements').delete().eq('id', statement.id);
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        insertedCount = toInsert.length;
      }
    }

    // Met à jour le compteur réel
    if (insertedCount !== txRows.length) {
      await supabaseAdmin
        .from('bank_statements')
        .update({ transaction_count: insertedCount })
        .eq('id', statement.id);
    }

    // Auto-match
    let stats = { total: insertedCount, matched: 0, ambiguous: 0, unmatched: insertedCount };
    try {
      stats = await autoMatchTransactions(supabaseAdmin, ownerUserId, statement.id);
    } catch (e) {
      console.error('Auto-match failed:', e);
    }

    return NextResponse.json({
      statement: { ...statement, transaction_count: insertedCount },
      stats,
      duplicates_skipped: txRows.length - insertedCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur inconnue' },
      { status: 500 },
    );
  }
}
