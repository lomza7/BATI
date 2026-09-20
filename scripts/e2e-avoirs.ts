/**
 * Test bout-en-bout des avoirs contre une base Supabase réelle.
 *
 * Il rejoue exactement ce que fait le dialog d'émission d'avoir — mêmes
 * helpers, mêmes colonnes, mêmes signes — puis relit la base pour vérifier que
 * ce qui a été écrit est juste. Il exerce donc le vrai chemin d'écriture, pas
 * une simulation.
 *
 * Il ne doit JAMAIS viser la production : la ref du projet est vérifiée et le
 * script s'arrête si l'URL n'est pas locale.
 *
 *   SUPABASE_URL=http://127.0.0.1:54921 SUPABASE_KEY=<service_role> \
 *     npx tsx scripts/e2e-avoirs.ts
 */

import { createClient } from '@supabase/supabase-js';
import { computeTvaBreakdown } from '@/lib/tva';
import {
  buildFullCreditNoteLines,
  buildPartialCreditNoteLine,
  claimedHt,
  claimedTtc,
  fetchCreditNotesByInvoice,
  fetchDepositsNetTtc,
  isFullyCredited,
  netDueTtc,
  remainingCreditableTtc,
  type SourceInvoiceLine,
} from '@/lib/invoices/credit-notes';
import { getNextCreditNoteNumber, getNextInvoiceNumber } from '@/lib/document-numbers';

const URL = process.env.SUPABASE_URL || '';
const KEY = process.env.SUPABASE_KEY || '';

if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL)) {
  console.error('Refus : ce script ne tourne que contre une base locale. SUPABASE_URL =', URL);
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
function eq(label: string, actual: unknown, expected: unknown) {
  check(label, Object.is(actual, expected), `attendu ${String(expected)}, obtenu ${String(actual)}`);
}
function near(label: string, actual: number, expected: number, tol = 0.011) {
  check(label, Math.abs(actual - expected) <= tol, `attendu ~${expected}, obtenu ${actual}`);
}
function section(t: string) {
  console.log(`\n${t}`);
}

const LINE_COLS =
  'description, detail, quantity, unit, unit_price, tva_rate, section, subsection, total, position';

/** Réplique fidèle de ce que fait CreateCreditNoteDialog. */
async function emitCreditNote(params: {
  userId: string;
  invoice: { id: string; invoice_number: string; total_ht: number; total_ttc: number; invoice_type?: string | null; quote_id?: string | null; client_id: string | null };
  mode: 'total' | 'partiel';
  amountHt?: number;
  tvaRate?: number;
  reason: string;
}) {
  const { userId, invoice, mode } = params;

  const { data: linesData } = await supabase
    .from('invoice_lines')
    .select(LINE_COLS)
    .eq('invoice_id', invoice.id)
    .order('position', { ascending: true });
  const sourceLines = (linesData as SourceInvoiceLine[] | null) || [];

  const depositsTtc =
    invoice.invoice_type === 'solde' && invoice.quote_id
      ? await fetchDepositsNetTtc(supabase, invoice.quote_id)
      : 0;

  const mirrorForbidden = invoice.invoice_type === 'solde' && depositsTtc > 0;
  const rate = params.tvaRate ?? 20;

  const totals =
    mode === 'total'
      ? mirrorForbidden
        ? computeTvaBreakdown([
            { quantity: 1, unit_price: -Math.abs(claimedHt(invoice, depositsTtc)), tva_rate: rate },
          ])
        : computeTvaBreakdown(buildFullCreditNoteLines(sourceLines, 'p', 'p'))
      : computeTvaBreakdown([
          { quantity: 1, unit_price: -Math.abs(params.amountHt || 0), tva_rate: rate },
        ]);

  const number = await getNextCreditNoteNumber(supabase, userId);
  const { data: created, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      invoice_number: number,
      invoice_type: 'avoir',
      credited_invoice_id: invoice.id,
      credit_reason: params.reason,
      client_id: invoice.client_id,
      title: `Avoir sur la facture ${invoice.invoice_number}`,
      total_ht: totals.total_ht,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
      tva_rate: totals.primary_rate,
      tva_breakdown: totals.tva_breakdown,
      status: 'creee',
      issued_at: new Date().toISOString(),
    })
    .select('id, invoice_number, total_ht, total_tva, total_ttc, tva_rate')
    .single();

  if (error || !created) throw new Error(error?.message || 'insert avoir impossible');

  const linesToInsert =
    mode === 'total' && sourceLines.length > 0 && !mirrorForbidden
      ? buildFullCreditNoteLines(sourceLines, userId, created.id)
      : [
          buildPartialCreditNoteLine({
            amountHt: mode === 'total' ? claimedHt(invoice, depositsTtc) : params.amountHt || 0,
            tvaRate: rate,
            label: mode === 'total' ? `Annulation de la facture ${invoice.invoice_number}` : 'Geste commercial',
            userId,
            creditNoteId: created.id,
          }),
        ];

  const { error: linesError } = await supabase.from('invoice_lines').insert(linesToInsert);
  if (linesError) {
    await supabase.from('invoices').delete().eq('id', created.id);
    throw new Error(linesError.message);
  }
  return created;
}

(async () => {
  // ── Compte de test isolé ────────────────────────────────────────────
  const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
  const userId = profiles?.[0]?.id as string;
  if (!userId) throw new Error('aucun profil dans la base locale');

  const { data: client } = await supabase
    .from('clients')
    .insert({ user_id: userId, name: 'Client E2E', contact_type: 'client' })
    .select('id')
    .single();
  const clientId = client!.id as string;

  section('1. Avoir total sur une facture standard multi-taux');

  const invNumber = await getNextInvoiceNumber(supabase, userId);
  const { data: inv } = await supabase
    .from('invoices')
    .insert({
      user_id: userId, invoice_number: invNumber, client_id: clientId,
      title: 'Renovation E2E', status: 'payee', invoice_type: 'standard',
      total_ht: 3000, total_tva: 500, total_ttc: 3500, tva_rate: 20,
      tva_breakdown: [
        { rate: 10, base_ht: 1000, tva_amount: 100 },
        { rate: 20, base_ht: 2000, tva_amount: 400 },
      ],
      issued_at: new Date().toISOString(),
    })
    .select('id, invoice_number, total_ht, total_ttc, invoice_type, quote_id, client_id')
    .single();

  await supabase.from('invoice_lines').insert([
    { user_id: userId, invoice_id: inv!.id, description: 'Pose carrelage', detail: 'Gres cerame', quantity: 20, unit: 'm2', unit_price: 50, tva_rate: 10, section: 'Salle de bain', subsection: 'Sols', total: 1000, position: 0 },
    { user_id: userId, invoice_id: inv!.id, description: 'Robinetterie', quantity: 1, unit: 'forfait', unit_price: 2000, tva_rate: 20, section: 'Salle de bain', total: 2000, position: 1 },
  ]);

  const avoir = await emitCreditNote({
    userId, invoice: inv as never, mode: 'total', reason: 'erreur_facturation',
  });

  check('numero dans la serie AV-', /^AV-\d{4}-\d{3}/.test(avoir.invoice_number), avoir.invoice_number);
  near('total HT negatif', Number(avoir.total_ht), -3000);
  near('total TVA negative', Number(avoir.total_tva), -500);
  near('total TTC negatif', Number(avoir.total_ttc), -3500);
  eq('taux principal = 20 (base 2000 dominante)', Number(avoir.tva_rate), 20);

  const { data: avLines } = await supabase
    .from('invoice_lines').select(LINE_COLS).eq('invoice_id', avoir.id).order('position');
  eq('deux lignes miroir', avLines!.length, 2);
  eq('taux 10 % preserve', Number(avLines![0].tva_rate), 10);
  eq('section preservee', avLines![0].section, 'Salle de bain');
  eq('subsection preservee', avLines![0].subsection, 'Sols');
  eq('detail preserve', avLines![0].detail, 'Gres cerame');
  check('quantite positive', Number(avLines![0].quantity) > 0);
  check('prix unitaire negatif', Number(avLines![0].unit_price) < 0);
  check(
    'invariant quantite x PU = total sur chaque ligne',
    avLines!.every((l: Record<string, number>) => Math.abs(Number(l.quantity) * Number(l.unit_price) - Number(l.total)) < 0.011),
  );

  const notes = await fetchCreditNotesByInvoice(supabase, [inv!.id]);
  const mine = notes.get(inv!.id) || [];
  eq('avoir rattache a la facture', mine.length, 1);
  near('net du apres avoir total', netDueTtc(inv as never, mine), 0);
  check('facture detectee comme integralement creditee', isFullyCredited(inv as never, mine));
  near('plus rien de creditable', remainingCreditableTtc(inv as never, mine), 0);

  section('2. Sur-creditation refusee et paiement impossible');

  let overCreditMessage = '';
  try {
    await emitCreditNote({ userId, invoice: inv as never, mode: 'partiel', amountHt: 100, tvaRate: 20, reason: 'autre' });
  } catch (e) {
    overCreditMessage = (e as Error).message;
  }
  check(
    'la base refuse un avoir qui depasse la facture',
    overCreditMessage.includes('avoir_depasse_facture'),
    overCreditMessage || 'un second avoir a ete accepte alors que la facture est deja soldee',
  );
  // Le plafond doit aussi resister a un UPDATE, pas seulement a un INSERT.
  const { error: bumpError } = await supabase
    .from('invoices')
    .update({ total_ttc: -9999, total_ht: -8000, total_tva: -1999 })
    .eq('id', avoir.id);
  check(
    'la base refuse de gonfler un avoir existant par UPDATE',
    !!bumpError && String(bumpError.message).includes('avoir_depasse_facture'),
    bumpError?.message || 'l UPDATE est passe',
  );

  const { error: payError } = await supabase.rpc('mark_invoice_paid', {
    p_invoice_id: avoir.id, p_payment_intent_id: 'pi_e2e', p_checkout_session_id: 'cs_e2e',
  });
  const { data: afterPay } = await supabase.from('invoices').select('status, paid_at').eq('id', avoir.id).single();
  check('mark_invoice_paid ne marque pas un avoir paye', afterPay!.status !== 'payee' && afterPay!.paid_at === null, `status=${afterPay!.status}`);
  check('aucune erreur remontee par le RPC', !payError);

  section('3. Facture de solde : l avoir ne credite pas les acomptes');

  const { data: quote } = await supabase
    .from('quotes')
    .insert({ user_id: userId, quote_number: `D-E2E-${Date.now() % 100000}`, client_id: clientId, title: 'Devis E2E', status: 'accepte', total_ht: 10000, total_ttc: 12000 })
    .select('id').single();

  const accNum = await getNextInvoiceNumber(supabase, userId);
  const { data: acompte } = await supabase.from('invoices').insert({
    user_id: userId, invoice_number: accNum, client_id: clientId, quote_id: quote!.id,
    title: 'Acompte 30%', status: 'payee', invoice_type: 'acompte', deposit_percentage: 30,
    total_ht: 3000, total_tva: 600, total_ttc: 3600, tva_rate: 20, issued_at: new Date().toISOString(),
  }).select('id, invoice_number, total_ht, total_ttc, invoice_type, quote_id, client_id').single();

  const soldeNum = await getNextInvoiceNumber(supabase, userId);
  const { data: solde } = await supabase.from('invoices').insert({
    user_id: userId, invoice_number: soldeNum, client_id: clientId, quote_id: quote!.id,
    title: 'Solde', status: 'envoyee', invoice_type: 'solde',
    total_ht: 10000, total_tva: 2000, total_ttc: 12000, tva_rate: 20, issued_at: new Date().toISOString(),
  }).select('id, invoice_number, total_ht, total_ttc, invoice_type, quote_id, client_id').single();

  near('acomptes nets avant tout avoir', await fetchDepositsNetTtc(supabase, quote!.id), 3600);
  near('le solde ne reclame que 8 400 TTC', claimedTtc(solde as never, 3600), 8400);
  near('part HT correspondante', claimedHt(solde as never, 3600), 7000);

  const avoirSolde = await emitCreditNote({
    userId, invoice: solde as never, mode: 'total', tvaRate: 20, reason: 'annulation',
  });
  near(
    'avoir total sur le solde = 8 400 TTC, pas 12 000',
    Number(avoirSolde.total_ttc), -8400,
  );

  section('4. Avoir sur un acompte : la deduction du solde baisse d autant');

  await emitCreditNote({
    userId, invoice: acompte as never, mode: 'partiel', amountHt: 500, tvaRate: 20, reason: 'geste_commercial',
  });
  near('acomptes nets apres avoir de 600 TTC', await fetchDepositsNetTtc(supabase, quote!.id), 3000);
  near(
    'le solde reclame desormais 9 000 TTC',
    claimedTtc(solde as never, await fetchDepositsNetTtc(supabase, quote!.id)),
    9000,
  );

  section('5. Le paywall n oppose pas de quota a un avoir');

  await supabase.from('profiles').update({ plan: 'free', subscription_status: null, is_admin: false }).eq('id', userId);
  const period = new Date().toISOString().slice(0, 7);
  await supabase.from('usage_counters').upsert(
    { user_id: userId, period, feature: 'invoice', count: 5 },
    { onConflict: 'user_id,period,feature' },
  );

  const blocked = await supabase.from('invoices').insert({
    user_id: userId, invoice_number: `F-QUOTA-${Date.now() % 10000}`, client_id: clientId,
    title: 'Quota', status: 'brouillon', invoice_type: 'standard', total_ht: 10, total_ttc: 12,
  });
  check('plan Gratuit sature : une facture est refusee', !!blocked.error, blocked.error?.message);

  let avoirOk = true;
  try {
    await emitCreditNote({ userId, invoice: acompte as never, mode: 'partiel', amountHt: 10, tvaRate: 20, reason: 'autre' });
  } catch (e) {
    avoirOk = false;
    console.log('     ', (e as Error).message);
  }
  check('plan Gratuit sature : un avoir passe quand meme', avoirOk);

  const { data: counter } = await supabase
    .from('usage_counters').select('count').eq('user_id', userId).eq('period', period).eq('feature', 'invoice').single();
  eq('le compteur de quota n a pas bouge', Number(counter!.count), 5);

  await supabase.from('profiles').update({ plan: 'pro', subscription_status: 'active' }).eq('id', userId);

  console.log(`\n${passed} verifications passees, ${failed} echouees`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error('\nERREUR FATALE :', e.message);
  process.exit(1);
});
