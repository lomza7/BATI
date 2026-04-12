/**
 * POST /api/import/backfill-projects
 *
 * One-shot endpoint: finds all invoices that have no linked project and
 * creates a project (chantier) for each one, using the client's address
 * so they show up on the map.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Find all invoices without a project
  const { data: orphanInvoices, error: fetchErr } = await sb
    .from('invoices')
    .select('id, title, client_id, status, total_ttc, issued_at, paid_at, invoice_number, invoice_type, quote_id, clients(name, address, city, postal_code)')
    .eq('user_id', user.id)
    .is('project_id', null);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!orphanInvoices || orphanInvoices.length === 0) {
    return NextResponse.json({ message: 'Aucune facture orpheline trouvée', created: 0, linked: 0 });
  }

  let created = 0;
  let linked = 0;
  const errors: string[] = [];

  for (const inv of orphanInvoices) {
    const invoiceType = (inv as { invoice_type?: string }).invoice_type || 'standard';
    const quoteId = (inv as { quote_id?: string }).quote_id || null;

    // Acompte/solde invoices belong to their quote's project — never create a new chantier
    if (invoiceType === 'acompte' || invoiceType === 'solde') {
      if (quoteId) {
        const { data: quote } = await sb
          .from('quotes')
          .select('project_id')
          .eq('id', quoteId)
          .maybeSingle();

        if (quote?.project_id) {
          await sb
            .from('invoices')
            .update({ project_id: quote.project_id })
            .eq('id', inv.id);
          linked++;
        }
      }
      // If no quote or quote has no project, skip — don't create a chantier
      continue;
    }

    const client = inv.clients as { name?: string; address?: string; city?: string; postal_code?: string } | null;
    const isCompleted = inv.status === 'payee';
    const projectName = inv.title || `Chantier — ${client?.name || 'Client'}`;

    const { data: project, error: projErr } = await sb
      .from('projects')
      .insert({
        user_id: user.id,
        name: projectName,
        client_id: inv.client_id,
        address: client?.address || '',
        city: client?.city || '',
        postal_code: client?.postal_code || '',
        status: isCompleted ? 'termine' : 'en_cours',
        progress: isCompleted ? 100 : 0,
        budget: inv.total_ttc || 0,
        start_date: inv.issued_at || null,
        end_date: isCompleted ? (inv.paid_at || inv.issued_at || null) : null,
        notes: inv.invoice_number
          ? `Importé depuis facture ${inv.invoice_number}`
          : 'Importé depuis facture',
        is_public: isCompleted,
        published_at: isCompleted ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (projErr || !project) {
      errors.push(`Facture ${inv.invoice_number}: ${projErr?.message || 'erreur inconnue'}`);
      continue;
    }

    // Link invoice to the new project
    await sb
      .from('invoices')
      .update({ project_id: project.id })
      .eq('id', inv.id);

    created++;
  }

  const standardCount = orphanInvoices.filter((i) => {
    const t = (i as { invoice_type?: string }).invoice_type || 'standard';
    return t === 'standard';
  }).length;

  return NextResponse.json({
    message: `${created} chantier${created > 1 ? 's' : ''} créé${created > 1 ? 's' : ''}, ${linked} facture${linked > 1 ? 's' : ''} d'acompte rattachée${linked > 1 ? 's' : ''}.`,
    created,
    linked,
    total: standardCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
