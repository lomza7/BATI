import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateToken } from '@/lib/comptabilite/accountant-scope';
import { buildFecFile, fecFileName } from '@/lib/comptabilite/fec-export';
import {
  fetchCreditNotesByInvoice,
  isCreditNote,
  isIssuedCreditNote,
  netDueTtc,
  sumCreditNotesTtc,
  type CreditNoteRef,
} from '@/lib/invoices/credit-notes';

export const runtime = 'nodejs';

/**
 * Statuts exclus du FEC : un brouillon n'a jamais été émis (son `issued_at`
 * est vide et le builder retomberait sur `created_at`), et une facture
 * annulée n'est atteignable que depuis l'état brouillon — c'est donc elle
 * aussi un document jamais émis. Ni l'un ni l'autre n'est du chiffre
 * d'affaires : les comptabiliser gonflerait le fichier remis à
 * l'administration et ferait diverger le CA du comptable de celui affiché à
 * l'artisan, qui écarte déjà les brouillons.
 */
const EXCLUDED_STATUSES_SQL = '(brouillon,annulee)';

/**
 * L'avoir a-t-il été émis AVANT le règlement de la facture qu'il rectifie ?
 *
 * Si oui, le client n'a viré que le net : c'est ce montant qui doit figurer
 * au journal de banque. Si l'avoir est postérieur au virement (cas le plus
 * fréquent, un avoir se constate après coup), la banque a bien reçu le brut
 * et l'avoir reste une dette au crédit du 411 jusqu'à remboursement.
 *
 * À égalité de date, l'avoir est réputé précéder le paiement : c'est le sens
 * du flux applicatif, où le client règle le montant net que l'app lui affiche.
 */
function precedesPayment(
  note: Pick<CreditNoteRef, 'issued_at' | 'created_at'>,
  paidAt: string | null,
): boolean {
  if (!paidAt) return false;
  const noteDate = note.issued_at || note.created_at;
  if (!noteDate) return false;
  const n = new Date(noteDate).getTime();
  const p = new Date(paidAt).getTime();
  if (Number.isNaN(n) || Number.isNaN(p)) return false;
  return n <= p;
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const validation = await validateToken(params.token);
  if (!validation.ok || !validation.access) {
    return NextResponse.json({ error: validation.error || 'Lien invalide' }, { status: validation.status });
  }
  const access = validation.access;
  const scope = validation.scope!;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('company_name, full_name, siret')
    .eq('id', access.user_id)
    .maybeSingle();

  let expenseQuery = supabaseAdmin
    .from('expenses')
    .select(
      `id, date, description, supplier, amount_ht, tva_amount, amount, tva_rate,
       expense_categories(slug)`,
    )
    .eq('user_id', access.user_id)
    .order('date', { ascending: true });
  if (scope.start) expenseQuery = expenseQuery.gte('date', scope.start);
  if (scope.end) expenseQuery = expenseQuery.lte('date', scope.end);
  const { data: expenses } = await expenseQuery;

  let invoiceQuery = supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, title, status, total_ht, total_ttc, tva_rate, tva_breakdown, paid_at, issued_at, created_at, client_id, invoice_type, credited_invoice_id, quote_id, clients(name)')
    .eq('user_id', access.user_id)
    .not('status', 'in', EXCLUDED_STATUSES_SQL)
    .order('created_at', { ascending: true });
  if (scope.start) invoiceQuery = invoiceQuery.gte('created_at', scope.start);
  if (scope.end) invoiceQuery = invoiceQuery.lte('created_at', scope.end + 'T23:59:59');
  const { data: invoices } = await invoiceQuery;

  // Pour calculer correctement le montant effectif des factures de solde
  // (brut - acomptes déjà facturés), il faut connaître **tous** les acomptes
  // liés — y compris ceux émis avant la période fiscale exportée. On les
  // fetch sans filtre de date sur les mêmes quote_ids pour éviter de
  // surestimer le CA quand le solde est dans la période mais l'acompte en
  // dehors.
  const soldeQuoteIds = Array.from(
    new Set(
      (invoices || [])
        .filter((inv: Record<string, unknown>) => inv.invoice_type === 'solde' && inv.quote_id)
        .map((inv: Record<string, unknown>) => String(inv.quote_id)),
    ),
  );
  const depositsByQuote = new Map<string, number>();
  if (soldeQuoteIds.length > 0) {
    const { data: linkedDeposits } = await supabaseAdmin
      .from('invoices')
      .select('id, quote_id, total_ttc')
      .eq('user_id', access.user_id)
      .eq('invoice_type', 'acompte')
      // Un acompte en brouillon n'a rien réclamé au client : le déduire du
      // solde amputerait le CA d'un montant jamais facturé.
      .not('status', 'in', EXCLUDED_STATUSES_SQL)
      .in('quote_id', soldeQuoteIds);
    const depositRows = (linkedDeposits || []) as Record<string, unknown>[];
    // Un acompte crédité par un avoir est déjà sorti du CA par l'écriture
    // inverse de l'avoir : le retrancher en BRUT du solde retirerait le même
    // montant une seconde fois du journal des ventes. On ne déduit donc que le
    // montant NET de chaque acompte (avoirs émis inclus, brouillons exclus).
    const notesByDeposit = await fetchCreditNotesByInvoice(
      supabaseAdmin,
      depositRows.map((d) => String(d.id)),
    );
    for (const d of depositRows) {
      const qid = String(d.quote_id);
      const netTtc = Math.max(
        0,
        Number(d.total_ttc || 0) + sumCreditNotesTtc(notesByDeposit.get(String(d.id)) || []),
      );
      depositsByQuote.set(qid, (depositsByQuote.get(qid) || 0) + netTtc);
    }
  }

  // Numéro de la facture rectifiée par chaque avoir. On le résout par une
  // requête dédiée plutôt que par un embed PostgREST : la facture rectifiée
  // peut très bien être hors de la période exportée (un avoir émis en N sur
  // une facture de N-1 est le cas le plus courant).
  const creditedInvoiceIds = Array.from(
    new Set(
      (invoices || [])
        .map((inv: Record<string, unknown>) => inv.credited_invoice_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const creditedNumberById = new Map<string, string>();
  if (creditedInvoiceIds.length > 0) {
    const { data: creditedInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number')
      .eq('user_id', access.user_id)
      .in('id', creditedInvoiceIds);
    for (const c of creditedInvoices || []) {
      const row = c as Record<string, unknown>;
      creditedNumberById.set(String(row.id), String(row.invoice_number || ''));
    }
  }

  const fiscalYear = scope.start ? new Date(scope.start).getFullYear() : new Date().getFullYear();
  const fiscalYearEnd = scope.end || `${fiscalYear}-12-31`;
  const artisanName = profile?.company_name || profile?.full_name || 'Hellobat';

  const expenseRows = (expenses || []).map((e: Record<string, unknown>) => ({
    id: String(e.id),
    date: String(e.date),
    description: String(e.description || ''),
    supplier: String(e.supplier || ''),
    amount_ht: e.amount_ht as number | null,
    tva_amount: e.tva_amount as number | null,
    amount: e.amount as number | null,
    tva_rate: e.tva_rate as number | null,
    category_slug:
      Array.isArray(e.expense_categories)
        ? ((e.expense_categories[0] as Record<string, unknown>)?.slug as string | null) || null
        : ((e.expense_categories as Record<string, unknown>)?.slug as string | null) || null,
  }));

  // Un avoir en brouillon n'est pas émis : il ne régularise rien et n'a donc
  // rien à faire dans le FEC, qui ne contient que des écritures validées. Le
  // filtre de statut posé sur la requête rend ce garde-fou redondant ; on le
  // conserve, il reste sans effet de bord.
  const exportedInvoices = ((invoices || []) as Record<string, unknown>[]).filter((inv) => {
    const type = (inv.invoice_type as string | null) || 'standard';
    if (!isCreditNote({ invoice_type: type })) return true;
    return isIssuedCreditNote({ status: inv.status as string | null });
  });

  // Avoirs émis sur les factures exportées. Une facture créditée AVANT son
  // règlement n'a encaissé que le net : c'est ce montant que réclament la page
  // publique et les routes de paiement, et c'est donc lui qui doit apparaître
  // au journal de banque.
  const notesByInvoice = await fetchCreditNotesByInvoice(
    supabaseAdmin,
    exportedInvoices
      .filter(
        (inv) => !isCreditNote({ invoice_type: (inv.invoice_type as string | null) || 'standard' }),
      )
      .map((inv) => String(inv.id)),
  );

  const invoiceRows = exportedInvoices.map((inv) => {
    const type = (inv.invoice_type as string | undefined) || 'standard';
    const qid = inv.quote_id as string | null | undefined;
    const rawHt = Number(inv.total_ht || 0);
    const rawTtc = Number(inv.total_ttc || 0);

    // Pour les factures de solde, on déduit les acomptes pour éviter le
    // double comptage du CA. Le ratio brut/net est appliqué au HT pour garder
    // une ligne FEC cohérente (HT + TVA = TTC).
    let effectiveHt = rawHt;
    let effectiveTtc = rawTtc;
    if (type === 'solde' && qid) {
      const deducted = depositsByQuote.get(String(qid)) || 0;
      effectiveTtc = Math.max(0, rawTtc - deducted);
      // Si le brut n'est pas nul, on applique le même ratio au HT pour que
      // (HT + TVA) reste égal au TTC effectif. Sinon on tombe à 0.
      effectiveHt = rawTtc > 0 ? Math.round((effectiveTtc * rawHt / rawTtc) * 100) / 100 : 0;
    }

    const creditedId = inv.credited_invoice_id as string | null | undefined;

    // Montant réellement encaissé, dans l'ordre canonique : base = ce que la
    // facture réclame (effectiveTtc, acomptes déjà déduits pour un solde),
    // puis retrait des seuls avoirs ANTÉRIEURS au règlement. Un avoir
    // postérieur au virement ne change rien : la banque a bien reçu le brut,
    // l'avoir reste une dette au 411 jusqu'à remboursement. Sans aucun avoir,
    // la valeur vaut exactement `effectiveTtc` et l'écriture est inchangée.
    const paidAt = inv.paid_at as string | null;
    const paidTtc = paidAt
      ? netDueTtc(
          { total_ttc: effectiveTtc },
          (notesByInvoice.get(String(inv.id)) || []).filter((n) => precedesPayment(n, paidAt)),
        )
      : null;

    return {
      id: String(inv.id),
      invoice_number: String(inv.invoice_number || ''),
      title: String(inv.title || ''),
      client_name:
        Array.isArray(inv.clients)
          ? ((inv.clients[0] as Record<string, unknown>)?.name as string | null) || ''
          : ((inv.clients as Record<string, unknown>)?.name as string | null) || '',
      // Montants d'un avoir laissés tels quels, donc négatifs : c'est
      // buildFecFile qui les repasse en positif du bon côté de l'écriture.
      total_ht: effectiveHt,
      tva_rate: inv.tva_rate as number | null,
      // Pour un solde, on ne passe pas le breakdown stocké (qui correspond au
      // brut) — le builder retombera sur le taux legacy pour générer une
      // paire de lignes cohérente avec le HT effectif.
      tva_breakdown: type === 'solde' ? null : inv.tva_breakdown,
      total_ttc: effectiveTtc,
      paid_at: paidAt,
      paid_ttc: paidTtc,
      issued_at: inv.issued_at as string | null,
      created_at: String(inv.created_at),
      invoice_type: type,
      credited_invoice_number: creditedId ? creditedNumberById.get(String(creditedId)) || null : null,
    };
  });

  const fec = buildFecFile({
    artisanName,
    expenses: expenseRows,
    invoices: invoiceRows,
    fiscalYear,
  });

  const filename = fecFileName(profile?.siret || null, fiscalYearEnd);

  return new NextResponse(fec, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
