import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';
import { docusealFetch } from '@/lib/docuseal';
import { buildContractHtml } from '@/lib/contract-template';
import { buildQuoteSignatureEmail, buildQuoteSentConfirmationEmail } from '@/lib/email-templates';
import { fetchCompanyAttachmentsForUser } from '@/lib/company-attachments';

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
    const { contract_id, client_name, client_email, expires_in_days, excluded_attachment_ids } = body as {
      contract_id: string;
      client_name: string;
      client_email?: string;
      expires_in_days?: number;
      excluded_attachment_ids?: string[];
    };

    if (!contract_id || !client_name?.trim()) {
      return NextResponse.json({ error: 'contract_id et client_name requis' }, { status: 400 });
    }

    const [contractRes, profileRes] = await Promise.all([
      admin.from('recurring_contracts').select('*, clients(*)').eq('id', contract_id).eq('user_id', user.id).single(),
      admin.from('profiles').select('company_name, full_name, siret, company_address, company_postal_code, company_city, company_phone, tva_number, logo_url, document_config').eq('id', user.id).single(),
    ]);

    if (contractRes.error || !contractRes.data) {
      return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 });
    }

    const contract = contractRes.data;
    const cl = contract.clients || {};
    const artisanRaw = profileRes.data || { company_name: 'Artisan' };

    const amountHt = Number(contract.amount) || 0;
    const tvaRate = 20;
    const amountTva = +(amountHt * (tvaRate / 100)).toFixed(2);
    const amountTtc = +(amountHt + amountTva).toFixed(2);

    const html = buildContractHtml(
      {
        contract_number: contract.contract_number || `CONTRAT-${contract.id.slice(0, 8)}`,
        title: contract.title || '',
        category_key: contract.category_key || 'autre',
        client_type: contract.client_type || 'b2c',
        contract_channel: contract.contract_channel || 'sur_site',
        duration_mode: contract.duration_mode || 'determinee',
        initial_term_months: Number(contract.initial_term_months) || 12,
        renewal_term_months: Number(contract.renewal_term_months) || 12,
        auto_renewal: contract.auto_renewal !== false,
        notice_period_months: Number(contract.notice_period_months) || 2,
        frequency: contract.frequency || 'mensuel',
        visits_per_year: Number(contract.visits_per_year) || 1,
        weather_dependent: Boolean(contract.weather_dependent),
        site_address: contract.site_address || '',
        site_access_notes: contract.site_access_notes || '',
        included_operations: Array.isArray(contract.included_operations) ? contract.included_operations : [],
        excluded_operations: Array.isArray(contract.excluded_operations) ? contract.excluded_operations : [],
        intervention_hours: contract.intervention_hours || 'Du lundi au vendredi, 8h-18h',
        emergency_phone: contract.emergency_phone || '',
        response_time: contract.response_time || '48h ouvrees',
        payment_method: contract.payment_method || 'virement',
        payment_timing: contract.payment_timing || 'terme_echu',
        payment_terms_days: Number(contract.payment_terms_days) || 30,
        late_penalty_rate: Number(contract.late_penalty_rate) || 10,
        recovery_fee: Number(contract.recovery_fee) || 40,
        breach_cure_period_days: Number(contract.breach_cure_period_days) || 30,
        amount_ht: amountHt,
        amount_tva: amountTva,
        amount_ttc: amountTtc,
        tva_rate: tvaRate,
        start_date: contract.start_date || new Date().toISOString(),
        end_date: contract.end_date,
        created_at: contract.created_at,
      },
      {
        name: cl.name || client_name.trim(),
        email: cl.email || client_email || '',
        phone: cl.phone || '',
        address: cl.address || '',
        postal_code: cl.postal_code || '',
        city: cl.city || '',
      },
      artisanRaw as Parameters<typeof buildContractHtml>[2],
    );

    const submitterEmail = client_email?.trim() || cl.email || `${contract_id}@placeholder.hellobat.app`;

    interface DocuSealTemplate { id: number; slug: string; name: string; documents?: { url: string }[]; }

    const template = await docusealFetch<DocuSealTemplate>('/templates/html', {
      method: 'POST',
      body: { html, name: `Contrat ${contract.contract_number || contract.id.slice(0, 8)}` },
    });

    if (!template?.id) {
      return NextResponse.json({ error: 'Erreur creation template DocuSeal' }, { status: 502 });
    }

    const contractPdfUrl = template.documents?.[0]?.url;
    let contractPdfBase64: string | null = null;
    const contractPdfFilename = `Contrat-${contract.contract_number || contract.id.slice(0, 8)}.pdf`;
    if (contractPdfUrl) {
      try {
        const pdfRes = await fetch(contractPdfUrl);
        if (pdfRes.ok) {
          const buf = Buffer.from(await pdfRes.arrayBuffer());
          contractPdfBase64 = buf.toString('base64');
        }
      } catch (e) {
        console.error('[create-contract-submission] PDF fetch failed:', e);
      }
    }

    interface DocuSealSubmitter { id: number; slug: string; submission_id: number; }

    const webhookBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';

    const docusealResponse = await docusealFetch<DocuSealSubmitter[]>('/submissions', {
      method: 'POST',
      body: {
        template_id: template.id,
        send_email: false,
        webhook_url: `${webhookBase}/api/docuseal/webhook`,
        submitters: [{ name: client_name.trim(), email: submitterEmail, send_email: false }],
      },
    });

    const submitter = Array.isArray(docusealResponse) ? docusealResponse[0] : null;
    if (!submitter?.slug || !submitter?.submission_id) {
      return NextResponse.json({ error: 'Reponse DocuSeal invalide' }, { status: 502 });
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expires_in_days || 30));

    const { error: insertError } = await admin.from('quote_sends').insert({
      user_id: user.id,
      recurring_contract_id: contract_id,
      document_kind: 'contract',
      client_name: client_name.trim(),
      client_email: client_email?.trim() || null,
      token,
      expires_at: expiresAt.toISOString(),
      docuseal_submission_id: submitter.submission_id,
      docuseal_slug: submitter.slug,
    });

    if (insertError) {
      return NextResponse.json({ error: 'Erreur creation du lien : ' + insertError.message }, { status: 500 });
    }

    await admin.from('recurring_contracts').update({
      docuseal_submission_id: submitter.submission_id,
      docuseal_submitter_id: submitter.id,
      status: 'en_attente',
      updated_at: new Date().toISOString(),
    }).eq('id', contract_id);

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
    const magicLink = `${base}/d/${token}`;

    const resendKey = process.env.RESEND_API_KEY;
    const recipientEmail = client_email?.trim() || cl.email;

    let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
    let emailError: string | null = null;
    let emailId: string | null = null;

    if (resendKey && recipientEmail) {
      const resend = new Resend(resendKey);
      const artisan = artisanRaw as Record<string, unknown>;
      const dc = (artisan.document_config as Record<string, string>) || {};
      const companyName = (artisan.company_name as string) || (artisan.full_name as string) || 'Artisan';

      const fmtTtc = new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
      }).format(amountTtc);

      const emailHtml = buildQuoteSignatureEmail({
        clientName: client_name.trim(),
        artisanName: companyName,
        quoteNumber: contract.contract_number || '—',
        quoteTitle: `Contrat ${contract.title || ''}`,
        totalTtc: `${fmtTtc} / an`,
        validUntil: null,
        magicLink,
        accentColor: dc.primary_color || '#d35400',
      });

      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hellobat <signature@send.hellobat.app>';

      const companyAttachments = await fetchCompanyAttachmentsForUser(
        admin,
        user.id,
        'quotes',
        { excludeIds: excluded_attachment_ids },
      );

      const clientAttachments = [
        ...companyAttachments.map((att) => ({ filename: att.name, content: att.content_base64 })),
        ...(contractPdfBase64 ? [{ filename: contractPdfFilename, content: contractPdfBase64 }] : []),
      ];

      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to: recipientEmail,
          subject: `Contrat ${contract.contract_number || ''} — ${companyName}`,
          html: emailHtml,
          attachments: clientAttachments,
        });

        if (user.email) {
          const confirmationHtml = buildQuoteSentConfirmationEmail({
            artisanName: companyName,
            clientName: client_name.trim(),
            clientEmail: recipientEmail,
            quoteNumber: contract.contract_number || '—',
            quoteTitle: `Contrat ${contract.title || ''}`,
            totalTtc: fmtTtc,
            accentColor: dc.primary_color || '#d35400',
          });
          resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `Confirmation d'envoi — Contrat ${contract.contract_number || ''}`,
            html: confirmationHtml,
            attachments: contractPdfBase64
              ? [{ filename: contractPdfFilename, content: contractPdfBase64 }]
              : undefined,
          }).catch((e) => console.error('[create-contract-submission] Artisan confirmation failed:', e));
        }

        if (result.error) {
          emailStatus = 'failed';
          emailError = result.error.message || 'Erreur inconnue';
        } else if (result.data?.id) {
          emailStatus = 'sent';
          emailId = result.data.id;
        }
      } catch (sendErr) {
        emailStatus = 'failed';
        emailError = sendErr instanceof Error ? sendErr.message : 'Erreur reseau';
      }
    } else if (!resendKey) {
      emailError = 'Service email non configure';
    } else {
      emailError = 'Aucune adresse email fournie';
    }

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
