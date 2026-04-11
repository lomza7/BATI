import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

interface CheckItem {
  client_name: string;
  client_address: string;
  invoice_date: string;
  invoice_number: string;
  amount_ttc: number;
}

export type DuplicateFlag = {
  index: number;
  reason: string;
};

export async function POST(request: Request) {
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

  const { data: membership } = await supabaseAdmin
    .from('workspace_memberships')
    .select('owner_user_id')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const ownerId = membership?.owner_user_id || user.id;

  let body: { items: CheckItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Items manquants' }, { status: 400 });
  }

  // Fetch existing invoice numbers
  const { data: existingInvoices } = await supabaseAdmin
    .from('invoices')
    .select('invoice_number')
    .eq('user_id', ownerId);

  const existingInvoiceNumbers = new Set(
    (existingInvoices || [])
      .map(function (inv) { return (inv.invoice_number || '').trim().toLowerCase(); })
      .filter(Boolean),
  );

  // Fetch existing projects with client info for fuzzy matching
  const { data: existingProjects } = await supabaseAdmin
    .from('projects')
    .select('name, address, city, budget, start_date, client_id, clients(name)')
    .eq('user_id', ownerId)
    .is('deleted_at', null);

  // Build a set of fingerprints: clientName|address|date|amount
  const existingFingerprints = new Set<string>();
  if (existingProjects) {
    for (let i = 0; i < existingProjects.length; i++) {
      const p = existingProjects[i] as Record<string, unknown>;
      const clientData = p.clients as { name?: string } | null;
      const clientName = (clientData?.name || '').trim().toLowerCase();
      const addr = ((p.address as string) || '').trim().toLowerCase();
      const date = ((p.start_date as string) || '').trim();
      const budget = Number(p.budget) || 0;
      if (clientName) {
        existingFingerprints.add(clientName + '|' + addr + '|' + date + '|' + budget);
        // Also match without date for broader detection
        existingFingerprints.add(clientName + '|' + addr + '|' + budget);
      }
    }
  }

  const duplicates: DuplicateFlag[] = [];

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];

    // Check invoice number match
    const invoiceNum = (item.invoice_number || '').trim().toLowerCase();
    if (invoiceNum && existingInvoiceNumbers.has(invoiceNum)) {
      duplicates.push({
        index: i,
        reason: 'Facture n°' + item.invoice_number + ' déjà existante',
      });
      continue;
    }

    // Check project fingerprint match (client + address + date + amount)
    const clientName = (item.client_name || '').trim().toLowerCase();
    const addr = (item.client_address || '').trim().toLowerCase();
    const date = (item.invoice_date || '').trim();
    const amount = item.amount_ttc || 0;

    if (clientName) {
      const fullFp = clientName + '|' + addr + '|' + date + '|' + amount;
      const shortFp = clientName + '|' + addr + '|' + amount;

      if (existingFingerprints.has(fullFp)) {
        duplicates.push({
          index: i,
          reason: 'Chantier similaire déjà existant pour ' + item.client_name,
        });
        continue;
      }

      if (existingFingerprints.has(shortFp)) {
        duplicates.push({
          index: i,
          reason: 'Chantier similaire existant (même client, adresse et montant)',
        });
        continue;
      }
    }
  }

  return NextResponse.json({ duplicates });
}
