import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildInvoicePaymentEmail } from '@/lib/email-templates';
import { getNextInvoiceNumber } from '@/lib/document-numbers';

export const runtime = 'nodejs';

interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
}

interface ContractRow {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  amount: number;
  frequency: string;
  tva_rate: number;
  next_billing: string;
  auto_send: boolean;
  line_items: LineItem[] | null;
  clients: { id: string; name: string; email: string | null } | null;
}

function computePeriodEnd(start: string, frequency: string): string {
  const d = new Date(start);
  if (frequency === 'mensuel') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'trimestriel') d.setMonth(d.getMonth() + 3);
  else if (frequency === 'annuel') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  // Fetch contracts due for billing
  const { data: contracts, error: fetchError } = await supabaseAdmin
    .from('recurring_contracts')
    .select('id, user_id, client_id, title, amount, frequency, tva_rate, next_billing, auto_send, line_items, clients(id, name, email)')
    .eq('status', 'actif')
    .lte('next_billing', today);

  if (fetchError || !contracts) {
    return NextResponse.json({ error: fetchError?.message || 'Erreur' }, { status: 500 });
  }

  let processed = 0;
  const errors: string[] = [];

  for (const contract of contracts as unknown as ContractRow[]) {
    try {
      // Generate sequential invoice number per user+year.
      const invoiceNumber = await getNextInvoiceNumber(supabaseAdmin, contract.user_id);

      const totalHt = contract.amount;
      const tvaRate = contract.tva_rate ?? 20;
      const totalTtc = Math.round(totalHt * (1 + tvaRate / 100) * 100) / 100;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .insert({
          user_id: contract.user_id,
          invoice_number: invoiceNumber,
          client_id: contract.client_id,
          recurring_contract_id: contract.id,
          title: contract.title,
          total_ht: totalHt,
          total_ttc: totalTtc,
          tva_rate: tvaRate,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'creee',
          issued_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (invoiceError || !invoice) {
        errors.push(`Contrat ${contract.id}: ${invoiceError?.message}`);
        continue;
      }

      // Create invoice lines (multi-line if contract has line_items)
      const items = Array.isArray(contract.line_items) && contract.line_items.length > 0
        ? contract.line_items
        : null;

      if (items) {
        await supabaseAdmin.from('invoice_lines').insert(
          items.map((item, i) => ({
            user_id: contract.user_id,
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || 'forfait',
            unit_price: item.unit_price,
            tva_rate: item.tva_rate ?? tvaRate,
            total: item.quantity * item.unit_price,
            position: i,
          }))
        );
      } else {
        await supabaseAdmin.from('invoice_lines').insert({
          user_id: contract.user_id,
          invoice_id: invoice.id,
          description: contract.title,
          quantity: 1,
          unit: 'forfait',
          unit_price: totalHt,
          total: totalHt,
          position: 0,
        });
      }

      // Link contract to invoice
      const periodEnd = computePeriodEnd(contract.next_billing, contract.frequency);
      await supabaseAdmin.from('contract_invoices').insert({
        user_id: contract.user_id,
        contract_id: contract.id,
        invoice_id: invoice.id,
        billing_period_start: contract.next_billing,
        billing_period_end: periodEnd,
      });

      // Advance billing date
      await supabaseAdmin.rpc('advance_contract_billing', { p_contract_id: contract.id });

      // Auto-send if enabled and client has email
      if (contract.auto_send && contract.clients?.email) {
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabaseAdmin.from('invoice_sends').insert({
          user_id: contract.user_id,
          invoice_id: invoice.id,
          client_name: contract.clients.name,
          client_email: contract.clients.email,
          token,
          expires_at: expiresAt.toISOString(),
        });

        // Update invoice status to envoyee
        await supabaseAdmin.from('invoices').update({
          status: 'envoyee',
          updated_at: new Date().toISOString(),
        }).eq('id', invoice.id);

        // Send email via Resend
        const resendKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM_EMAIL;
        if (resendKey && fromEmail) {
          // Fetch artisan profile for email template
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('company_name, full_name, document_config')
            .eq('id', contract.user_id)
            .maybeSingle();

          const artisanName = profile?.company_name || profile?.full_name || 'Votre artisan';
          const accent = profile?.document_config?.primary_color || '#d35400';
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
          const magicLink = `${siteUrl}/f/${token}`;
          const totalFormatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalTtc);

          // Check if artisan has Stripe connected
          const { data: stripeConn } = await supabaseAdmin
            .from('stripe_connections')
            .select('charges_enabled')
            .eq('user_id', contract.user_id)
            .maybeSingle();

          const html = buildInvoicePaymentEmail({
            clientName: contract.clients.name,
            artisanName,
            invoiceNumber,
            invoiceTitle: contract.title,
            totalTtc: totalFormatted,
            dueDate: null,
            magicLink,
            hasOnlinePayment: !!stripeConn?.charges_enabled,
            accentColor: accent,
          });

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: contract.clients.email,
              subject: `Facture ${invoiceNumber} — ${artisanName}`,
              html,
            }),
          });
        }
      }

      processed++;
    } catch (err) {
      errors.push(`Contrat ${contract.id}: ${err instanceof Error ? err.message : 'Erreur'}`);
    }
  }

  return NextResponse.json({ processed, total: contracts.length, errors });
}
