import type { SupabaseClient } from '@supabase/supabase-js';

// Document numbers: en prod, un helper server-side (lib/document-numbers.ts)
// alloue séquentiellement. Pour les tests on génère un suffixe unique pour
// éviter les collisions sur la contrainte UNIQUE (quote_number, invoice_number).
function uniqueSuffix(): string {
  return `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export async function seedClient(
  admin: SupabaseClient,
  userId: string,
  opts: { name?: string; email?: string } = {},
): Promise<{ id: string; name: string; email: string }> {
  const suffix = uniqueSuffix();
  const name = opts.name ?? `Client E2E ${suffix}`;
  const email = opts.email ?? `client-${suffix}@test.hellobat.app`;
  const { data, error } = await admin
    .from('clients')
    .insert({
      user_id: userId,
      contact_type: 'client',
      name,
      email,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`seedClient failed: ${error?.message ?? 'no row'}`);
  }
  return { id: data.id, name, email };
}

export async function seedQuote(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
  opts: { title?: string; totalHt?: number } = {},
): Promise<{ id: string; quoteNumber: string }> {
  const totalHt = opts.totalHt ?? 1000;
  const tvaRate = 20;
  const totalTtc = totalHt * (1 + tvaRate / 100);
  const year = new Date().getFullYear();
  const quoteNumber = `E2E-D-${year}-${uniqueSuffix()}`;
  const { data, error } = await admin
    .from('quotes')
    .insert({
      user_id: userId,
      client_id: clientId,
      quote_number: quoteNumber,
      title: opts.title ?? 'Devis E2E',
      status: 'brouillon',
      total_ht: totalHt,
      tva_rate: tvaRate,
      total_ttc: totalTtc,
      valid_until: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`seedQuote failed: ${error?.message ?? 'no row'}`);
  }
  const { error: lineError } = await admin.from('quote_lines').insert({
    user_id: userId,
    quote_id: data.id,
    position: 0,
    description: 'Prestation test E2E',
    quantity: 1,
    unit: 'forfait',
    unit_price: totalHt,
    total: totalHt,
  });
  if (lineError) {
    throw new Error(`seedQuote line failed: ${lineError.message}`);
  }
  return { id: data.id, quoteNumber };
}

export async function seedInvoice(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
  opts: { totalHt?: number } = {},
): Promise<{ id: string; invoiceNumber: string }> {
  const totalHt = opts.totalHt ?? 500;
  const tvaRate = 20;
  const totalTtc = totalHt * (1 + tvaRate / 100);
  const year = new Date().getFullYear();
  const invoiceNumber = `E2E-F-${year}-${uniqueSuffix()}`;
  const { data, error } = await admin
    .from('invoices')
    .insert({
      user_id: userId,
      client_id: clientId,
      invoice_number: invoiceNumber,
      title: 'Facture E2E',
      status: 'brouillon',
      total_ht: totalHt,
      tva_rate: tvaRate,
      total_ttc: totalTtc,
      due_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`seedInvoice failed: ${error?.message ?? 'no row'}`);
  }
  const { error: lineError } = await admin.from('invoice_lines').insert({
    user_id: userId,
    invoice_id: data.id,
    position: 0,
    description: 'Prestation test E2E',
    quantity: 1,
    unit: 'forfait',
    unit_price: totalHt,
    total: totalHt,
  });
  if (lineError) {
    throw new Error(`seedInvoice line failed: ${lineError.message}`);
  }
  return { id: data.id, invoiceNumber };
}
