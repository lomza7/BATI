import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateToken } from '@/lib/comptabilite/accountant-scope';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const validation = await validateToken(params.token);
  if (!validation.ok || !validation.access) {
    return NextResponse.json({ error: validation.error || 'Lien invalide' }, { status: validation.status });
  }
  const access = validation.access;
  const scope = validation.scope!;

  let query = supabaseAdmin
    .from('invoices')
    .select(
      `id, invoice_number, title, status, issued_at, due_date, paid_at, created_at,
       total_ht, total_ttc, tva_rate, total_tva, tva_breakdown, client_id,
       invoice_type, deposit_percentage, quote_id, credited_invoice_id, credit_reason,
       clients(name)`,
    )
    .eq('user_id', access.user_id)
    .order('issued_at', { ascending: false, nullsFirst: false });

  if (scope.start) query = query.gte('created_at', scope.start);
  if (scope.end) query = query.lte('created_at', scope.end + 'T23:59:59');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // La facture rectifiée par un avoir peut être hors de la période consultée
  // (un avoir émis en N sur une facture de N-1 est le cas le plus courant).
  // On résout donc son numéro par une requête dédiée, et on l'expose à plat :
  // la référence à la facture rectifiée est une mention légale obligatoire
  // (art. 242 nonies A ann. II CGI), le comptable doit la voir sans clic.
  const rows = (data || []) as Record<string, unknown>[];
  const creditedInvoiceIds = Array.from(
    new Set(
      rows
        .map((inv) => inv.credited_invoice_id as string | null)
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

  const invoices = rows.map((inv) => {
    const creditedId = inv.credited_invoice_id as string | null | undefined;
    return {
      ...inv,
      invoice_type: (inv.invoice_type as string | null) || 'standard',
      credited_invoice_number: creditedId ? creditedNumberById.get(String(creditedId)) || null : null,
    };
  });

  return NextResponse.json({ invoices });
}
