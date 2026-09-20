import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCreditNoteImportItem } from '@/lib/ai/invoice-import-schema';

export const runtime = 'nodejs';

interface CheckItem {
  client_name: string;
  client_address: string;
  invoice_date: string;
  invoice_number: string;
  amount_ttc: number;
  amount_ht?: number;
  /** 'facture' (défaut) ou 'avoir'. */
  document_type?: string;
  /** Avoirs : numéro de la facture rectifiée, tel que lu sur le document. */
  credited_invoice_number?: string;
}

/** Arrondi à 2 décimales — même règle que lib/tva.ts. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Empreinte d'un avoir : facture rectifiée + montant TTC + date d'émission.
 *
 * Un avoir importé prend un numéro regénéré dans la série AV- et ne crée aucun
 * chantier : ni la détection par `invoice_number`, ni l'empreinte de chantier
 * ne peuvent le reconnaître. Sans cette clé, un même avoir rescanné déduirait
 * deux fois de la facture d'origine.
 *
 * NOTE : même clé dans app/api/ai/invoice-import/commit/route.ts, qui fait foi.
 * Les deux doivent rester alignées (helper volontairement local, cf. lot
 * d'implémentation des avoirs).
 */
function creditNoteFingerprint(
  creditedInvoiceId: string,
  totalTtc: number,
  issuedAt: string | null | undefined,
): string {
  const day = String(issuedAt || '').slice(0, 10);
  return creditedInvoiceId + '|' + round2(Math.abs(num(totalTtc))).toFixed(2) + '|' + day;
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

  // Fetch existing invoices (numbers + données nécessaires aux avoirs)
  const { data: existingInvoices } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, invoice_type, credited_invoice_id, total_ttc, issued_at')
    .eq('user_id', ownerId);

  const existingInvoiceNumbers = new Set(
    (existingInvoices || [])
      .map(function (inv) { return (inv.invoice_number || '').trim().toLowerCase(); })
      .filter(Boolean),
  );

  // Numéro → id, pour résoudre la facture rectifiée référencée par un avoir.
  const invoiceIdByNumber = new Map<string, string>();
  const existingCreditNoteFingerprints = new Set<string>();
  for (const inv of existingInvoices || []) {
    const number = (inv.invoice_number || '').trim().toLowerCase();
    if (number && inv.invoice_type !== 'avoir') {
      invoiceIdByNumber.set(number, inv.id as string);
    }
    if (inv.invoice_type === 'avoir' && inv.credited_invoice_id) {
      existingCreditNoteFingerprints.add(
        creditNoteFingerprint(
          inv.credited_invoice_id as string,
          inv.total_ttc as number,
          inv.issued_at as string | null,
        ),
      );
    }
  }

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

    // Avoir : l'empreinte de chantier ne veut rien dire (un avoir n'en crée
    // aucun). On compare à la facture rectifiée, au montant et à la date.
    if (isCreditNoteImportItem(item)) {
      const creditedNumber = (item.credited_invoice_number || '').trim().toLowerCase();
      const creditedId = creditedNumber ? invoiceIdByNumber.get(creditedNumber) : undefined;
      if (creditedId) {
        const fingerprint = creditNoteFingerprint(creditedId, item.amount_ttc, item.invoice_date);
        if (existingCreditNoteFingerprints.has(fingerprint)) {
          duplicates.push({
            index: i,
            reason: 'Avoir déjà importé sur la facture n°' + (item.credited_invoice_number || '').trim(),
          });
        }
      }
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
