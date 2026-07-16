import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';
import { docusealFetch, buildQuoteHtml } from '@/lib/docuseal';
import { buildQuoteSignatureEmail, buildQuoteSentConfirmationEmail } from '@/lib/email-templates';
import { fetchCompanyAttachmentsForUser } from '@/lib/company-attachments';
import { resolveFromEmail } from '@/lib/email-from';

export const runtime = 'nodejs';

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function POST(request: Request) {
  try {
    // Verifier auth via le header Authorization (token Supabase)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Client avec le token de l'utilisateur pour verifier l'identite
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    // Client admin pour les operations privilegiees
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 503 });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { quote_id, client_name, client_email, expires_in_days, excluded_attachment_ids } = body as {
      quote_id: string;
      client_name: string;
      client_email?: string;
      expires_in_days: number;
      excluded_attachment_ids?: string[];
    };

    if (!quote_id || !client_name?.trim()) {
      return NextResponse.json({ error: 'quote_id et client_name requis' }, { status: 400 });
    }

    // Fetch quote + lines + client + artisan profile
    const [quoteRes, linesRes, profileRes] = await Promise.all([
      admin.from('quotes').select('*, clients(*)').eq('id', quote_id).eq('user_id', user.id).is('deleted_at', null).single(),
      admin.from('quote_lines').select('*').eq('quote_id', quote_id).order('position'),
      admin.from('profiles').select('company_name, full_name, siret, company_address, company_postal_code, company_city, company_phone, tva_number, logo_url, document_config').eq('id', user.id).single(),
    ]);

    if (quoteRes.error || !quoteRes.data) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    const quote = quoteRes.data;
    const lines = (linesRes.data || []).map((l: Record<string, unknown>) => ({
      description: (l.description as string) || '',
      quantity: Number(l.quantity) || 0,
      unit: (l.unit as string) || 'u',
      unit_price: Number(l.unit_price) || 0,
      tva_rate: Number(l.tva_rate ?? 20),
      total: Number(l.total) || 0,
    }));
    const client = quote.clients || { name: client_name.trim() };
    const artisanRaw = profileRes.data || { company_name: 'Artisan' };
    const artisan = artisanRaw as Record<string, unknown> & { company_name: string };

    // Nettoyer la description si elle contient un texte de brouillon IA
    const rawDesc = (quote.description || '') as string;
    const cleanDescription = rawDesc.replace(/^Brouillon (de devis |préparé ).*$/im, '').trim();

    // Generer le HTML du devis
    const html = buildQuoteHtml(
      {
        quote_number: quote.quote_number,
        title: quote.title || '',
        description: cleanDescription,
        total_ht: Number(quote.total_ht) || 0,
        total_tva: Number(quote.total_tva) || 0,
        total_ttc: Number(quote.total_ttc) || 0,
        tva_rate: Number(quote.tva_rate) || 20,
        tva_breakdown: quote.tva_breakdown,
        created_at: quote.created_at,
        valid_until: quote.valid_until,
      },
      lines,
      {
        name: client.name || client_name.trim(),
        email: client.email || client_email || '',
        phone: client.phone || '',
        address: client.address || '',
        postal_code: client.postal_code || '',
        city: client.city || '',
      },
      artisan as { company_name: string; full_name?: string; siret?: string; company_address?: string; company_postal_code?: string; company_city?: string; company_phone?: string; tva_number?: string; logo_url?: string; document_config?: Record<string, unknown> },
    );

    // Etape 1 — Creer un template DocuSeal a partir du HTML du devis
    const submitterEmail = client_email?.trim() || client.email || `${quote_id}@placeholder.hellobat.app`;

    interface DocuSealTemplate {
      id: number;
      slug: string;
      name: string;
    }

    const template = await docusealFetch<DocuSealTemplate>('/templates/html', {
      method: 'POST',
      body: {
        html,
        name: `Devis ${quote.quote_number}`,
      },
    });

    if (!template?.id) {
      return NextResponse.json({ error: 'Erreur creation template DocuSeal' }, { status: 502 });
    }

    // Etape 2 — Creer une submission avec ce template
    interface DocuSealSubmitter {
      id: number;
      slug: string;
      submission_id: number;
    }

    const webhookBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';

    const docusealResponse = await docusealFetch<DocuSealSubmitter[]>('/submissions', {
      method: 'POST',
      body: {
        template_id: template.id,
        send_email: false,
        webhook_url: `${webhookBase}/api/docuseal/webhook`,
        submitters: [
          {
            name: client_name.trim(),
            email: submitterEmail,
            send_email: false,
          },
        ],
      },
    });

    // DocuSeal retourne un tableau de submitters
    const submitter = Array.isArray(docusealResponse) ? docusealResponse[0] : null;
    if (!submitter?.slug || !submitter?.submission_id) {
      return NextResponse.json({ error: 'Reponse DocuSeal invalide' }, { status: 502 });
    }

    // Creer le quote_send en base
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expires_in_days || 14));

    const { data: sendRow, error: insertError } = await admin
      .from('quote_sends')
      .insert({
        user_id: user.id,
        quote_id,
        client_name: client_name.trim(),
        client_email: client_email?.trim() || null,
        token,
        expires_at: expiresAt.toISOString(),
        docuseal_submission_id: submitter.submission_id,
        docuseal_slug: submitter.slug,
      })
      .select('id')
      .single();

    if (insertError || !sendRow) {
      return NextResponse.json({ error: 'Erreur creation du lien' }, { status: 500 });
    }
    const sendId = sendRow.id as string;

    // Passer le devis en "envoye" si brouillon
    if (quote.status === 'brouillon') {
      await admin.from('quotes').update({
        status: 'envoye',
        description: cleanDescription,
        updated_at: new Date().toISOString(),
      }).eq('id', quote_id);
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
    const magicLink = `${base}/d/${token}`;
    const pdfUrl = `${base}/api/public/devis/${token}/pdf`;

    // Envoyer l'email au client via Resend
    const resendKey = process.env.RESEND_API_KEY;
    const recipientEmail = client_email?.trim() || client.email;

    // Statut d'envoi email — retourne au frontend pour affichage honnête
    let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
    let emailError: string | null = null;
    let emailId: string | null = null;

    if (!resendKey) {
      emailStatus = 'skipped';
      emailError = 'Service email non configuré (RESEND_API_KEY manquante)';
    } else if (!recipientEmail) {
      emailStatus = 'skipped';
      emailError = 'Aucune adresse email fournie pour le client';
    } else {
      const resend = new Resend(resendKey);
      const dc = ((artisan.document_config as Record<string, string>) || {});
      const companyName = (artisan.company_name as string) || (artisan.full_name as string) || 'Artisan';

      const fmtTtc = new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
      }).format(Number(quote.total_ttc) || 0);

      const fmtValid = quote.valid_until
        ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(quote.valid_until))
        : null;

      const emailHtml = buildQuoteSignatureEmail({
        clientName: client_name.trim(),
        artisanName: companyName,
        quoteNumber: quote.quote_number,
        quoteTitle: quote.title || '',
        totalTtc: fmtTtc,
        validUntil: fmtValid,
        magicLink,
        pdfUrl,
        accentColor: dc.primary_color || '#d35400',
      });

      const fromEmail = resolveFromEmail('Hellobat <signature@hellobat.app>');

      // Charger les attestations / pieces jointes par defaut de l'artisan
      // (sauf celles que l'utilisateur a explicitement decochees dans le dialog).
      const companyAttachments = await fetchCompanyAttachmentsForUser(
        admin,
        user.id,
        'quotes',
        { excludeIds: excluded_attachment_ids },
      );

      // Resend SDK v6+ retourne { data, error } au lieu de throw —
      // on vérifie explicitement l'erreur pour ne plus avaler silencieusement
      // les échecs de délivrabilité (domaine non vérifié, adresse invalide, etc.)
      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to: recipientEmail,
          subject: `Devis ${quote.quote_number} — ${companyName}`,
          html: emailHtml,
          attachments: companyAttachments.map(att => ({
            filename: att.name,
            content: att.content_base64,
          })),
        });

        // Confirmation d'envoi à l'artisan — sans lien de signature, pour éviter
        // qu'il signe lui-même à la place du client. Fire-and-forget : une erreur
        // sur la confirmation ne doit pas faire échouer l'envoi au client.
        if (user.email) {
          const confirmationHtml = buildQuoteSentConfirmationEmail({
            artisanName: companyName,
            clientName: client_name.trim(),
            clientEmail: recipientEmail,
            quoteNumber: quote.quote_number,
            quoteTitle: quote.title || '',
            totalTtc: fmtTtc,
            accentColor: dc.primary_color || '#d35400',
          });
          resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `Confirmation d'envoi — Devis ${quote.quote_number}`,
            html: confirmationHtml,
          }).catch((e) => console.error('[create-submission] Artisan confirmation failed:', e));
        }

        if (result.error) {
          emailStatus = 'failed';
          emailError = result.error.message || 'Erreur inconnue lors de l\'envoi';
          console.error('[create-submission] Resend API error:', result.error);
        } else if (result.data?.id) {
          emailStatus = 'sent';
          emailId = result.data.id;
        } else {
          emailStatus = 'failed';
          emailError = 'Réponse Resend inattendue (pas d\'ID de message)';
          console.error('[create-submission] Resend unexpected response:', result);
        }
      } catch (sendErr) {
        emailStatus = 'failed';
        emailError = sendErr instanceof Error ? sendErr.message : 'Erreur réseau lors de l\'envoi';
        console.error('[create-submission] Resend send exception:', sendErr);
      }
    }

    // Persister le statut dans quote_sends (le webhook Resend complètera
    // delivered/bounced/complained plus tard).
    await admin
      .from('quote_sends')
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
