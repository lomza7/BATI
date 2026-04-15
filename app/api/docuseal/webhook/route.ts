import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { computeDepositAmount } from '@/lib/invoices/deposits';
import { getNextInvoiceNumber } from '@/lib/document-numbers';
import { docusealFetch } from '@/lib/docuseal';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

// DocuSeal n'offre pas de HMAC natif sur les webhooks. On authentifie le
// payload avec deux couches:
//   1. Un secret partage fourni en header X-Docuseal-Secret (ou en query
//      ?secret=...) — l'artisan configure ce secret dans l'URL webhook cote
//      DocuSeal. Comparaison en temps constant.
//   2. On re-fetch la submission sur l'API DocuSeal avec la cle API pour
//      confirmer que l'etat reel est bien 'completed'.
function verifyWebhookSecret(request: Request): boolean {
  const expected = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (!expected) return false;
  const url = new URL(request.url);
  const received =
    request.headers.get('x-docuseal-secret') ||
    url.searchParams.get('secret') ||
    '';
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    if (!verifyWebhookSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const eventType = body.event_type;
    if (eventType !== 'form.completed') {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const data = body.data;
    if (!data?.submission_id) {
      return NextResponse.json({ error: 'submission_id manquant' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Config serveur manquante' }, { status: 503 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Extraire les donnees DocuSeal
    const submissionId = data.submission_id as number;
    const submitterId = data.id as number | undefined;

    // Double-check serveur: on verifie aupres de DocuSeal que la submission
    // est reellement completee avant de la marquer signee en base.
    interface DocuSealSubmission {
      id: number;
      status: string;
      audit_log_url?: string;
      submitters: {
        id: number;
        status: string;
        ip?: string;
        documents?: { name: string; url: string }[];
      }[];
    }
    const verified = await docusealFetch<DocuSealSubmission>(`/submissions/${submissionId}`).catch(() => null);
    if (!verified || verified.status !== 'completed') {
      return NextResponse.json({ ok: true, skipped: 'status_not_completed' });
    }

    const verifiedSubmitter = verified.submitters?.find(s => s.id === submitterId) || verified.submitters?.[0];
    const auditLogUrl = verified.audit_log_url || '';
    const signedDocumentUrl = verifiedSubmitter?.documents?.[0]?.url || '';
    const signerIp = verifiedSubmitter?.ip || '';

    // Appeler la RPC sign_quote_docuseal
    const { data: rpcResult, error: rpcError } = await admin.rpc('sign_quote_docuseal', {
      p_docuseal_submission_id: submissionId,
      p_docuseal_submitter_id: submitterId || null,
      p_audit_log_url: auditLogUrl,
      p_signed_document_url: signedDocumentUrl,
      p_certificate_url: '', // DocuSeal inclut le certificat dans l'audit log
      p_signer_ip: signerIp,
    });

    if (rpcError) {
      console.error('sign_quote_docuseal error:', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Auto-création facture d'acompte si le devis a un deposit_percentage
    if (rpcResult?.success && !rpcResult?.already_signed) {
      try {
        await maybeCreateDepositInvoice(admin, submissionId);
      } catch (err) {
        console.error('Auto deposit invoice error:', err);
      }
    }

    return NextResponse.json({ ok: true, result: rpcResult });
  } catch (err) {
    console.error('DocuSeal webhook error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

async function maybeCreateDepositInvoice(
  admin: SupabaseClient,
  docusealSubmissionId: number,
) {
  // 1. Trouver le devis via quote_sends
  const { data: send } = await admin
    .from('quote_sends')
    .select('quote_id')
    .eq('docuseal_submission_id', docusealSubmissionId)
    .single();

  if (!send?.quote_id) return;

  // 2. Charger le devis avec deposit_percentage
  const { data: quote } = await admin
    .from('quotes')
    .select('id, quote_number, title, user_id, client_id, project_id, bank_account_id, total_ht, total_ttc, tva_rate, deposit_percentage')
    .eq('id', send.quote_id)
    .single();

  if (!quote?.deposit_percentage || quote.deposit_percentage <= 0) return;

  // 3. Idempotence — vérifier qu'aucune facture d'acompte n'existe déjà
  const { data: existing } = await admin
    .from('invoices')
    .select('id')
    .eq('quote_id', quote.id)
    .eq('invoice_type', 'acompte')
    .neq('status', 'annulee')
    .limit(1);

  if (existing && existing.length > 0) return;

  // 4. Calculer les montants
  const pct = quote.deposit_percentage;
  const safeRate = quote.tva_rate ?? 20;
  const preview = computeDepositAmount('percentage', pct, quote.total_ht, safeRate);

  // 5. Générer le numéro de facture
  const invoiceNumber = await getNextInvoiceNumber(admin, quote.user_id);

  // 6. Échéance = 15 jours
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 15);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  // 7. Label du pourcentage
  const pctLabel = Number.isInteger(pct) ? `${pct}` : pct.toFixed(2).replace('.', ',');

  // 8. Créer la facture d'acompte (brouillon)
  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .insert({
      user_id: quote.user_id,
      invoice_number: invoiceNumber,
      invoice_type: 'acompte',
      deposit_percentage: pct,
      quote_id: quote.id,
      client_id: quote.client_id,
      project_id: quote.project_id || null,
      bank_account_id: quote.bank_account_id,
      title: `Acompte ${pctLabel}% — ${quote.title}`,
      description: `Acompte sur le devis ${quote.quote_number}`,
      total_ht: preview.total_ht,
      total_tva: preview.total_tva,
      total_ttc: preview.total_ttc,
      tva_rate: safeRate,
      tva_breakdown: [{ rate: safeRate, base_ht: preview.total_ht, tva_amount: preview.total_tva }],
      due_date: dueDateStr,
      status: 'brouillon',
    })
    .select('id')
    .single();

  if (invoiceError || !invoice) return;

  // 9. Créer la ligne de facture
  await admin.from('invoice_lines').insert({
    user_id: quote.user_id,
    invoice_id: invoice.id,
    description: `Acompte de ${pctLabel} % sur devis ${quote.quote_number}`,
    quantity: 1,
    unit: 'forfait',
    unit_price: preview.total_ht,
    tva_rate: safeRate,
    total: preview.total_ht,
    position: 0,
  });
}
