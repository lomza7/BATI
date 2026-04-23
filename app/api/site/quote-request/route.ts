import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { getNextQuoteNumber } from '@/lib/document-numbers';

export const runtime = 'nodejs';

/**
 * POST /api/site/quote-request
 *
 * Public endpoint — called from the artisan's published site (no auth header).
 * Receives a contact form submission and dispatches it across the artisan's workspace :
 *   1. Upserts a `clients` row (contact_type = prospect)
 *   2. Creates a `leads` row in the CRM (stage: nouveau, source: site_web)
 *   3. Creates a `todos` row so the artisan sees it in his task list
 *   4. Creates a draft `quotes` row so the artisan can finish the devis in one click
 *   5. Sends an email notification to the artisan via Resend
 *
 * Service role is required to bypass RLS since the caller is anonymous.
 */
export async function POST(request: Request) {
  // Burst protection — 5 demandes par IP par minute
  const ip = getClientIp(request);
  const rl = checkRateLimit(`site-quote:ip:${ip}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: {
    slug?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    project?: string;
    budget?: string;
    turnstile_token?: string;
    // Honeypot — should always be empty
    company_website?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requete invalide' }, { status: 400 });
  }

  // Basic honeypot — bots fill every field, legitimate users don't see this one
  if (body.company_website && body.company_website.trim().length > 0) {
    // Return 200 to not tip off bots
    return NextResponse.json({ success: true });
  }

  // Vérification Turnstile (no-op si TURNSTILE_SECRET_KEY pas configurée)
  const turnstile = await verifyTurnstile(body.turnstile_token, ip);
  if (!turnstile.ok) {
    return NextResponse.json(
      { error: 'Vérification anti-bot échouée. Rechargez la page et réessayez.' },
      { status: 400 },
    );
  }

  const slug = body.slug?.trim();
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim();
  const projectDescription = body.project?.trim();

  if (!slug) {
    return NextResponse.json({ error: 'Site introuvable' }, { status: 400 });
  }
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Votre nom est requis' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }
  if (!phone || phone.length < 6) {
    return NextResponse.json({ error: 'Telephone requis' }, { status: 400 });
  }
  if (!projectDescription || projectDescription.length < 10) {
    return NextResponse.json(
      { error: 'Merci de decrire brievement votre projet (10 caracteres minimum)' },
      { status: 400 }
    );
  }

  // Enforce max lengths to prevent abuse
  const safeName = name.slice(0, 120);
  const safeEmail = email.slice(0, 200);
  const safePhone = phone.slice(0, 40);
  const safeAddress = (body.address || '').trim().slice(0, 200);
  const safeCity = (body.city || '').trim().slice(0, 80);
  const safePostalCode = (body.postal_code || '').trim().slice(0, 20);
  const safeProject = projectDescription.slice(0, 4000);
  const safeBudget = (body.budget || '').trim().slice(0, 40);

  // 1. Find the artisan via the published site
  const { data: site, error: siteError } = await supabaseAdmin
    .from('artisan_sites')
    .select('id, user_id, slug, status')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site introuvable' }, { status: 404 });
  }

  const artisanUserId = site.user_id as string;

  // Fetch artisan profile (for email branding) + auth email
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, company_name, company_phone')
    .eq('id', artisanUserId)
    .maybeSingle();

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(artisanUserId);
  const artisanEmail = authUser?.user?.email || '';
  const artisanName = profile?.company_name || profile?.full_name || 'Artisan';

  // 2. Upsert client (prospect) — match on email within this user's workspace
  let clientId: string | null = null;
  if (safeEmail) {
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('user_id', artisanUserId)
      .eq('email', safeEmail)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingClient?.id) {
      clientId = existingClient.id as string;
      // Patch the existing contact with any new info
      await supabaseAdmin
        .from('clients')
        .update({
          name: safeName,
          phone: safePhone || undefined,
          address: safeAddress || undefined,
          city: safeCity || undefined,
          postal_code: safePostalCode || undefined,
        })
        .eq('id', clientId);
    } else {
      const { data: inserted } = await supabaseAdmin
        .from('clients')
        .insert({
          user_id: artisanUserId,
          name: safeName,
          email: safeEmail,
          phone: safePhone,
          address: safeAddress,
          city: safeCity,
          postal_code: safePostalCode,
          contact_type: 'prospect',
          source: 'site_web',
          notes: `Demande de devis recue via le site web le ${new Date().toLocaleDateString('fr-FR')}`,
        })
        .select('id')
        .single();
      clientId = inserted?.id || null;
    }
  }

  // 3. Create a draft quote
  const quoteNumber = await getNextQuoteNumber(supabaseAdmin, artisanUserId);
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const quoteTitle = `Demande site web - ${safeName}`;
  const quoteDescription = [
    `Demande recue via le formulaire de contact du site web.`,
    ``,
    `Client : ${safeName}`,
    `Email : ${safeEmail}`,
    `Telephone : ${safePhone}`,
    safeAddress || safeCity ? `Adresse : ${[safeAddress, safePostalCode, safeCity].filter(Boolean).join(', ')}` : '',
    safeBudget ? `Budget indicatif : ${safeBudget}` : '',
    ``,
    `Projet :`,
    safeProject,
  ]
    .filter(Boolean)
    .join('\n');

  const { data: quote } = await supabaseAdmin
    .from('quotes')
    .insert({
      user_id: artisanUserId,
      quote_number: quoteNumber,
      client_id: clientId,
      title: quoteTitle,
      description: quoteDescription,
      status: 'brouillon',
      total_ht: 0,
      tva_rate: 20,
      total_ttc: 0,
      valid_until: validUntil.toISOString().slice(0, 10),
    })
    .select('id')
    .single();

  // 4. Create the lead in the CRM
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .insert({
      user_id: artisanUserId,
      client_id: clientId,
      quote_id: quote?.id || null,
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      source: 'site_web',
      stage: 'nouveau',
      project_address: safeAddress,
      project_city: safeCity,
      project_postal_code: safePostalCode,
      work_details: safeProject,
      notes: safeBudget ? `Budget indicatif : ${safeBudget}` : '',
      urgency: 'normal',
    })
    .select('id')
    .single();

  // 5. Create a todo for the artisan
  await supabaseAdmin.from('todos').insert({
    user_id: artisanUserId,
    title: `Rappeler ${safeName} (demande site web)`,
    description: `${safePhone} - ${safeEmail}\n\n${safeProject.slice(0, 500)}${safeProject.length > 500 ? '...' : ''}`,
    priority: 'haute',
    category: 'client',
    client_id: clientId,
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  // 6. Send notification email to the artisan
  const resendKey = process.env.RESEND_API_KEY;
  let emailSent = false;
  if (resendKey && artisanEmail) {
    try {
      const resend = new Resend(resendKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hellobat <equipe@send.hellobat.app>';
      const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
      const quoteLink = quote?.id ? `${origin.replace(/\/$/, '')}/devis` : '';

      const html = buildQuoteRequestEmail({
        artisanName,
        clientName: safeName,
        clientEmail: safeEmail,
        clientPhone: safePhone,
        clientAddress: [safeAddress, safePostalCode, safeCity].filter(Boolean).join(', '),
        projectDescription: safeProject,
        budget: safeBudget,
        quoteLink,
      });

      await resend.emails.send({
        from: fromEmail,
        to: artisanEmail,
        replyTo: safeEmail,
        subject: `Nouvelle demande de devis - ${safeName}`,
        html,
      });
      emailSent = true;
    } catch (e) {
      console.error('Site quote-request email error:', e);
    }
  }

  return NextResponse.json({
    success: true,
    lead_id: lead?.id || null,
    quote_id: quote?.id || null,
    email_sent: emailSent,
  });
}

// ── Email template ─────────────────────────────────────────────

interface QuoteRequestEmailData {
  artisanName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  projectDescription: string;
  budget: string;
  quoteLink: string;
}

function buildQuoteRequestEmail(data: QuoteRequestEmailData): string {
  const accent = '#d35400';
  const budgetLine = data.budget
    ? `<tr><td style="padding:6px 0;font-size:13px;color:#6b6560">Budget indicatif</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600">${esc(data.budget)}</td></tr>`
    : '';
  const addressLine = data.clientAddress
    ? `<tr><td style="padding:6px 0;font-size:13px;color:#6b6560">Adresse</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600">${esc(data.clientAddress)}</td></tr>`
    : '';

  const ctaBlock = data.quoteLink
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
         <tr><td align="center">
           <a href="${data.quoteLink}" target="_blank" style="display:inline-block;background-color:${accent};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px">
             Ouvrir le devis en brouillon
           </a>
         </td></tr>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Nouvelle demande de devis</title></head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:'Inter','Helvetica Neue',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr><td style="background-color:${accent};padding:24px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.8);letter-spacing:1.5px;text-transform:uppercase;font-weight:600">Hellobat</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#ffffff">Nouvelle demande de devis</p>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a">Bonjour <strong>${esc(data.artisanName)}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;color:#6b6560;line-height:1.6">
            Vous avez recu une nouvelle demande de devis via votre site web. Un client, un lead CRM et un devis en brouillon ont ete crees automatiquement.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f7;border-radius:12px;border:1px solid #e5e1da">
            <tr><td style="padding:16px 20px">
              <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:600">Contact</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:4px 0;font-size:13px;color:#6b6560;width:120px">Nom</td><td style="padding:4px 0;font-size:14px;color:#1a1a1a;font-weight:600">${esc(data.clientName)}</td></tr>
                <tr><td style="padding:4px 0;font-size:13px;color:#6b6560">Telephone</td><td style="padding:4px 0;font-size:14px;color:#1a1a1a;font-weight:600"><a href="tel:${esc(data.clientPhone)}" style="color:${accent};text-decoration:none">${esc(data.clientPhone)}</a></td></tr>
                <tr><td style="padding:4px 0;font-size:13px;color:#6b6560">Email</td><td style="padding:4px 0;font-size:14px;color:#1a1a1a;font-weight:600"><a href="mailto:${esc(data.clientEmail)}" style="color:${accent};text-decoration:none">${esc(data.clientEmail)}</a></td></tr>
                ${addressLine}
                ${budgetLine}
              </table>
            </td></tr>
          </table>
          <div style="margin-top:20px">
            <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:600">Projet</p>
            <div style="background-color:#faf9f7;border-radius:12px;border:1px solid #e5e1da;padding:16px 20px;font-size:14px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap">${esc(data.projectDescription)}</div>
          </div>
          ${ctaBlock}
          <p style="margin:24px 0 0;font-size:12px;color:#999;text-align:center">
            Vous pouvez repondre directement a cet email : il arrivera a ${esc(data.clientName)}.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function esc(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
