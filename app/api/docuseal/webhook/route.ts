import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { computeDepositAmount } from '@/lib/invoices/deposits';
import { getNextInvoiceNumber } from '@/lib/document-numbers';
import { docusealFetch } from '@/lib/docuseal';
import { buildContractSignedClientEmail, buildContractSignedArtisanEmail } from '@/lib/email-templates';
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

    // Auto-création facture d'acompte si le devis a un deposit_percentage.
    // Aucune facture standard n'est créée automatiquement — l'artisan choisit
    // via "Devis convertibles" -> "Facturer" quand il est prêt.
    if (rpcResult?.success && !rpcResult?.already_signed) {
      try {
        await maybeCreateDepositInvoice(admin, submissionId);
      } catch (err) {
        console.error('Auto deposit invoice error:', err);
      }
      try {
        await maybeSendSignedContractEmail(admin, submissionId, signedDocumentUrl);
      } catch (err) {
        console.error('Signed contract email error:', err);
      }
    }

    return NextResponse.json({ ok: true, result: rpcResult });
  } catch (err) {
    console.error('DocuSeal webhook error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

async function maybeSendSignedContractEmail(
  admin: SupabaseClient,
  docusealSubmissionId: number,
  signedDocumentUrl: string,
) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !signedDocumentUrl) return;

  const { data: send } = await admin
    .from('quote_sends')
    .select('user_id, recurring_contract_id, document_kind, client_email, client_name')
    .eq('docuseal_submission_id', docusealSubmissionId)
    .single();

  if (!send || send.document_kind !== 'contract' || !send.recurring_contract_id) return;

  const [{ data: contract }, { data: profile }, { data: authUser }] = await Promise.all([
    admin
      .from('recurring_contracts')
      .select('contract_number, title, clients(name, email)')
      .eq('id', send.recurring_contract_id)
      .single(),
    admin
      .from('profiles')
      .select('company_name, full_name, document_config')
      .eq('id', send.user_id)
      .single(),
    admin.auth.admin.getUserById(send.user_id),
  ]);

  if (!contract) return;

  // Fetch signed PDF as base64
  let pdfBase64: string | null = null;
  try {
    const pdfRes = await fetch(signedDocumentUrl);
    if (pdfRes.ok) {
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      pdfBase64 = buf.toString('base64');
    }
  } catch (e) {
    console.error('Signed PDF fetch failed:', e);
  }

  const resend = new Resend(resendKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hellobat <signature@hellobat.app>';
  const dc = ((profile?.document_config as Record<string, string>) || {});
  const accentColor = dc.primary_color || '#d35400';
  const companyName = profile?.company_name || profile?.full_name || 'Artisan';
  const contractNumber = contract.contract_number || '—';
  const contractTitle = contract.title || '';
  const signedAt = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const filename = `Contrat-${contractNumber}-signe.pdf`;
  const attachments = pdfBase64 ? [{ filename, content: pdfBase64 }] : undefined;

  const clientRel = Array.isArray(contract.clients) ? contract.clients[0] : contract.clients;
  const clientEmail = (send.client_email || (clientRel as { email?: string } | null)?.email || '').trim();
  const clientName = (send.client_name || (clientRel as { name?: string } | null)?.name || 'Client').trim();

  if (clientEmail) {
    await resend.emails.send({
      from: fromEmail,
      to: clientEmail,
      subject: `Votre contrat signé — ${contractNumber}`,
      html: buildContractSignedClientEmail({
        clientName,
        artisanName: companyName,
        contractNumber,
        contractTitle,
        signedAt,
        accentColor,
      }),
      attachments,
    }).catch((e) => console.error('Client signed-contract email failed:', e));
  }

  const artisanEmail = authUser?.user?.email;
  if (artisanEmail) {
    await resend.emails.send({
      from: fromEmail,
      to: artisanEmail,
      subject: `${clientName} a signé le contrat ${contractNumber}`,
      html: buildContractSignedArtisanEmail({
        artisanName: companyName,
        clientName,
        contractNumber,
        contractTitle,
        signedAt,
        accentColor,
      }),
      attachments,
    }).catch((e) => console.error('Artisan signed-contract email failed:', e));
  }
}

async function maybeCreateDepositInvoice(
  admin: SupabaseClient,
  docusealSubmissionId: number,
) {
  const { data: send } = await admin
    .from('quote_sends')
    .select('quote_id')
    .eq('docuseal_submission_id', docusealSubmissionId)
    .single();

  if (!send?.quote_id) return;

  const { data: quote } = await admin
    .from('quotes')
    .select('id, quote_number, title, user_id, client_id, project_id, bank_account_id, total_ht, total_ttc, tva_rate, deposit_percentage')
    .eq('id', send.quote_id)
    .single();

  if (!quote?.deposit_percentage || quote.deposit_percentage <= 0) return;

  const { data: existing } = await admin
    .from('invoices')
    .select('id')
    .eq('quote_id', quote.id)
    .eq('invoice_type', 'acompte')
    .neq('status', 'annulee')
    .limit(1);
  if (existing && existing.length > 0) return;

  const pct = quote.deposit_percentage;
  const safeRate = quote.tva_rate ?? 20;
  const preview = computeDepositAmount('percentage', pct, quote.total_ht, safeRate);
  const invoiceNumber = await getNextInvoiceNumber(admin, quote.user_id);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 15);
  const dueDateStr = dueDate.toISOString().split('T')[0];
  const pctLabel = Number.isInteger(pct) ? `${pct}` : pct.toFixed(2).replace('.', ',');

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
