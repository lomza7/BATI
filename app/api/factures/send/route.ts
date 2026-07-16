import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';
import { buildInvoicePaymentEmail } from '@/lib/email-templates';
import { fetchCompanyAttachmentsForUser } from '@/lib/company-attachments';
import { resolveFromEmail } from '@/lib/email-from';

export const runtime = 'nodejs';

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 503 });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { invoice_id, client_name, client_email, expires_in_days, excluded_attachment_ids, reminders_enabled, enable_stripe_payment } = body as {
      invoice_id: string;
      client_name: string;
      client_email?: string;
      expires_in_days: number;
      excluded_attachment_ids?: string[];
      reminders_enabled?: boolean;
      enable_stripe_payment?: boolean;
    };

    if (!invoice_id || !client_name?.trim()) {
      return NextResponse.json({ error: 'invoice_id et client_name requis' }, { status: 400 });
    }

    // Charger la facture + le profil + la connexion Stripe en parallele
    const [invoiceRes, profileRes, stripeRes] = await Promise.all([
      admin
        .from('invoices')
        .select('id, invoice_number, title, total_ttc, status, due_date, issued_at, invoice_type, deposit_percentage, quote_id, clients(name, email)')
        .eq('id', invoice_id)
        .eq('user_id', user.id)
        .single(),
      admin
        .from('profiles')
        .select('company_name, full_name, document_config')
        .eq('id', user.id)
        .single(),
      admin
        .from('stripe_connections')
        .select('charges_enabled')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (invoiceRes.error || !invoiceRes.data) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
    }

    const invoice = invoiceRes.data as {
      id: string;
      invoice_number: string;
      title: string;
      total_ttc: number;
      status: string;
      due_date: string | null;
      issued_at: string | null;
      invoice_type: 'standard' | 'acompte' | 'solde' | null;
      deposit_percentage: number | null;
      quote_id: string | null;
      clients?: { name?: string | null; email?: string | null } | null;
    };

    // Pour un acompte / solde, on récupère le numéro du devis source pour
    // l'afficher dans la narration de l'email.
    let relatedQuoteNumber: string | null = null;
    if (invoice.quote_id && (invoice.invoice_type === 'acompte' || invoice.invoice_type === 'solde')) {
      const { data: quoteRow } = await admin
        .from('quotes')
        .select('quote_number')
        .eq('id', invoice.quote_id)
        .maybeSingle();
      relatedQuoteNumber = quoteRow?.quote_number || null;
    }

    const profile = (profileRes.data || {}) as {
      company_name?: string | null;
      full_name?: string | null;
      document_config?: Record<string, unknown> | null;
    };

    const hasOnlinePayment = Boolean(stripeRes.data?.charges_enabled);

    // Creer le magic link
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expires_in_days || 30));

    const { data: sendRow, error: insertError } = await admin
      .from('invoice_sends')
      .insert({
        user_id: user.id,
        invoice_id,
        client_name: client_name.trim(),
        client_email: client_email?.trim() || null,
        token,
        expires_at: expiresAt.toISOString(),
        enable_stripe_payment: Boolean(enable_stripe_payment),
      })
      .select('id')
      .single();

    if (insertError || !sendRow) {
      return NextResponse.json({ error: 'Erreur creation du lien' }, { status: 500 });
    }
    const sendId = sendRow.id as string;

    // Passer la facture en envoyee + set issued_at si necessaire
    const updates: Record<string, string | boolean> = {
      status: 'envoyee',
      updated_at: new Date().toISOString(),
      reminders_enabled: reminders_enabled ?? false,
    };
    if (invoice.status === 'brouillon' || invoice.status === 'creee') {
      updates.issued_at = new Date().toISOString();
    }
    await admin.from('invoices').update(updates).eq('id', invoice_id);

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
    const magicLink = `${base}/f/${token}`;
    const pdfUrl = `${base}/api/public/factures/${token}/pdf`;

    // Envoi email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    const recipientEmail = client_email?.trim() || invoice.clients?.email || '';

    let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
    let emailError: string | null = null;
    let emailId: string | null = null;

    if (!resendKey) {
      emailStatus = 'skipped';
      emailError = 'Service email non configure (RESEND_API_KEY manquante)';
    } else if (!recipientEmail) {
      emailStatus = 'skipped';
      emailError = 'Aucune adresse email fournie pour le client';
    } else {
      const resend = new Resend(resendKey);
      const dc = (profile.document_config || {}) as Record<string, string>;
      const companyName = profile.company_name || profile.full_name || 'Artisan';

      // Pour un solde : on déduit les acomptes versés du montant affiché dans
      // l'email pour éviter de montrer un montant incorrect au client.
      let displayTotalTtc = Number(invoice.total_ttc) || 0;
      if (invoice.invoice_type === 'solde' && invoice.quote_id) {
        const { data: deposits } = await admin
          .from('invoices')
          .select('total_ttc')
          .eq('quote_id', invoice.quote_id)
          .eq('invoice_type', 'acompte')
          .neq('status', 'annulee');
        const deducted = (deposits || []).reduce(
          (sum, d) => sum + Number(d.total_ttc || 0),
          0,
        );
        displayTotalTtc = Math.max(0, displayTotalTtc - deducted);
      }

      const totalFormatted = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
      }).format(displayTotalTtc);

      const dueDateFormatted = invoice.due_date
        ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(invoice.due_date))
        : null;

      const emailHtml = buildInvoicePaymentEmail({
        clientName: client_name.trim(),
        artisanName: companyName,
        invoiceNumber: invoice.invoice_number,
        invoiceTitle: invoice.title || '',
        totalTtc: totalFormatted,
        dueDate: dueDateFormatted,
        magicLink,
        pdfUrl,
        hasOnlinePayment,
        accentColor: dc.primary_color || '#d35400',
        invoiceType: invoice.invoice_type || 'standard',
        depositPercentage: invoice.deposit_percentage,
        relatedQuoteNumber,
      });

      // Pieces jointes par defaut (attestations, assurances, etc.) — on
      // exclut celles que l'utilisateur a decochees dans le dialog.
      const companyAttachments = await fetchCompanyAttachmentsForUser(
        admin,
        user.id,
        'invoices',
        { excludeIds: excluded_attachment_ids },
      );

      const fromEmail = resolveFromEmail('Hellobat <facture@hellobat.app>');
      const copyEmail = user.email?.trim();
      const shouldCopySender = Boolean(
        copyEmail && copyEmail.toLowerCase() !== recipientEmail.toLowerCase(),
      );

      // Sujet : adapte le libellé selon le type de facture
      const subjectPrefix = invoice.invoice_type === 'acompte'
        ? `Facture d'acompte ${invoice.invoice_number}`
        : invoice.invoice_type === 'solde'
          ? `Facture de solde ${invoice.invoice_number}`
          : `Facture ${invoice.invoice_number}`;

      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to: recipientEmail,
          ...(shouldCopySender ? { cc: copyEmail } : {}),
          subject: `${subjectPrefix} — ${companyName}`,
          html: emailHtml,
          attachments: companyAttachments.map(att => ({
            filename: att.name,
            content: att.content_base64,
          })),
        });

        if (result.error) {
          emailStatus = 'failed';
          emailError = result.error.message || 'Erreur inconnue lors de l\'envoi';
          console.error('[factures/send] Resend API error:', result.error);
        } else if (result.data?.id) {
          emailStatus = 'sent';
          emailId = result.data.id;
        } else {
          emailStatus = 'failed';
          emailError = 'Reponse Resend inattendue (pas d\'ID de message)';
        }
      } catch (sendErr) {
        emailStatus = 'failed';
        emailError = sendErr instanceof Error ? sendErr.message : 'Erreur reseau lors de l\'envoi';
        console.error('[factures/send] Resend send exception:', sendErr);
      }
    }

    // Persister le statut dans invoice_sends pour que l'artisan puisse
    // voir si l'envoi a abouti (mis à jour par le webhook Resend ensuite :
    // delivered / bounced / complained).
    await admin
      .from('invoice_sends')
      .update({
        email_status: emailStatus,
        email_error: emailError,
        email_provider_id: emailId,
        email_sent_at: emailStatus === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', sendId);

    return NextResponse.json({
      magic_link: magicLink,
      token,
      email_status: emailStatus,
      email_error: emailError,
      email_provider_id: emailId,
      recipient_email: recipientEmail || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
