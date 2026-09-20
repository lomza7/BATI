import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateToken } from '@/lib/comptabilite/accountant-scope';
import { parseTvaBreakdown, formatTvaRate } from '@/lib/tva';
import { creditReasonLabel, invoiceTypeLabel, isCreditNote } from '@/lib/invoices/credit-notes';

export const runtime = 'nodejs';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value).replace(/"/g, '""');
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.join(';')];
  for (const r of rows) lines.push(r.map(csvEscape).join(';'));
  // BOM UTF-8 pour Excel
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export async function GET(request: Request, { params }: { params: { token: string } }) {
  const validation = await validateToken(params.token);
  if (!validation.ok || !validation.access) {
    return NextResponse.json({ error: validation.error || 'Lien invalide' }, { status: validation.status });
  }
  const access = validation.access;
  const scope = validation.scope!;

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'expenses';

  if (type === 'expenses') {
    let q = supabaseAdmin
      .from('expenses')
      .select(
        `date, supplier, description, amount_ht, tva_rate, tva_amount, amount,
         is_autoliquidation, payment_method, source,
         expense_categories(name)`,
      )
      .eq('user_id', access.user_id)
      .order('date', { ascending: false });
    if (scope.start) q = q.gte('date', scope.start);
    if (scope.end) q = q.lte('date', scope.end);
    const { data } = await q;

    const headers = [
      'Date',
      'Fournisseur',
      'Description',
      'Catégorie',
      'Montant HT',
      'Taux TVA',
      'Montant TVA',
      'Montant TTC',
      'Autoliquidation',
      'Mode paiement',
      'Source',
    ];
    const rows = (data || []).map((e: Record<string, unknown>) => [
      e.date,
      e.supplier,
      e.description,
      Array.isArray(e.expense_categories)
        ? ((e.expense_categories[0] as Record<string, unknown>)?.name as string | null) || ''
        : ((e.expense_categories as Record<string, unknown>)?.name as string | null) || '',
      e.amount_ht,
      e.tva_rate,
      e.tva_amount,
      e.amount,
      e.is_autoliquidation ? 'Oui' : 'Non',
      e.payment_method || '',
      e.source || 'manual',
    ]);

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="depenses-${scope.start || 'tout'}.csv"`,
      },
    });
  }

  if (type === 'invoices') {
    let q = supabaseAdmin
      .from('invoices')
      .select(
        `invoice_number, title, status, issued_at, due_date, paid_at, total_ht, tva_rate, total_tva, tva_breakdown, total_ttc,
         invoice_type, deposit_percentage, credited_invoice_id, credit_reason,
         clients(name)`,
      )
      .eq('user_id', access.user_id)
      .order('issued_at', { ascending: false, nullsFirst: false });
    if (scope.start) q = q.gte('created_at', scope.start);
    if (scope.end) q = q.lte('created_at', scope.end + 'T23:59:59');
    const { data } = await q;

    // Numéro de la facture rectifiée par chaque avoir. Requête à part : la
    // facture rectifiée est souvent hors de la période exportée (avoir émis
    // en N sur une facture de N-1).
    const creditedInvoiceIds = Array.from(
      new Set(
        (data || [])
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

    const headers = [
      'Numéro',
      'Titre',
      'Type',
      'Client',
      'Statut',
      'Émise le',
      'Échéance',
      'Payée le',
      'Montant HT',
      'Taux TVA principal',
      'Montant TVA',
      'Montant TTC',
      'Détail TVA multi-taux',
      'Facture rectifiée',
      'Motif de l\'avoir',
    ];
    const rows = (data || []).map((inv: Record<string, unknown>) => {
      const invoiceType = (inv.invoice_type as string | null) || 'standard';
      const isAvoir = isCreditNote({ invoice_type: invoiceType });
      const breakdown = parseTvaBreakdown(inv.tva_breakdown);
      const totalHt = Number(inv.total_ht || 0);
      const totalTtc = Number(inv.total_ttc || 0);
      // Les montants d'un avoir sont négatifs : borner à 0 la TVA reconstruite
      // ferait disparaître la TVA régularisée de l'export du comptable.
      const fallbackTva = isAvoir
        ? Math.min(0, totalTtc - totalHt)
        : Math.max(0, totalTtc - totalHt);
      const totalTva = inv.total_tva != null ? Number(inv.total_tva) : fallbackTva;
      const detailTva =
        breakdown.length > 1
          ? breakdown
              .map(
                (b) =>
                  `${formatTvaRate(b.rate)} sur ${b.base_ht.toFixed(2).replace('.', ',')} € HT = ${b.tva_amount.toFixed(2).replace('.', ',')} €`,
              )
              .join(' + ')
          : '';
      // Facture / Acompte / Solde / Avoir — le comptable doit pouvoir trier
      // l'export sur cette colonne sans relire les montants.
      const pct = inv.deposit_percentage as number | null;
      const typeLabel =
        invoiceType === 'acompte' && pct
          ? `Acompte ${pct}%`
          : invoiceTypeLabel(invoiceType);
      const creditedId = inv.credited_invoice_id as string | null | undefined;
      const creditedNumber = creditedId ? creditedNumberById.get(String(creditedId)) || '' : '';
      return [
        inv.invoice_number,
        inv.title,
        typeLabel,
        Array.isArray(inv.clients)
          ? ((inv.clients[0] as Record<string, unknown>)?.name as string | null) || ''
          : ((inv.clients as Record<string, unknown>)?.name as string | null) || '',
        inv.status,
        inv.issued_at || '',
        inv.due_date || '',
        inv.paid_at || '',
        inv.total_ht,
        inv.tva_rate,
        totalTva.toFixed(2),
        inv.total_ttc,
        detailTva,
        creditedNumber,
        isAvoir ? creditReasonLabel(inv.credit_reason as string | null) : '',
      ];
    });

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="factures-${scope.start || 'tout'}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: 'Type inconnu' }, { status: 400 });
}
