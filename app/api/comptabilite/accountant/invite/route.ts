import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateAccessToken } from '@/lib/comptabilite/accountant-scope';
import { buildAccountantInvitationEmail } from '@/lib/email-templates';
import { resolveFromEmail } from '@/lib/email-from';

export const runtime = 'nodejs';

const ALLOWED_SCOPES = new Set(['full', 'fiscal_year', 'period']);

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
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const accountantEmail = String(body?.accountant_email || '').trim().toLowerCase();
  const accountantName = String(body?.accountant_name || '').trim();
  const scope = String(body?.scope || 'full');
  const scopeYear = body?.scope_year != null ? Number(body.scope_year) : null;
  const scopeStart = body?.scope_start ? String(body.scope_start) : null;
  const scopeEnd = body?.scope_end ? String(body.scope_end) : null;
  const durationDays = Math.max(1, Math.min(366, Number(body?.duration_days || 90)));

  if (!accountantEmail || !accountantEmail.includes('@')) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }
  if (!ALLOWED_SCOPES.has(scope)) {
    return NextResponse.json({ error: 'Périmètre invalide' }, { status: 400 });
  }
  if (scope === 'fiscal_year' && (!scopeYear || scopeYear < 2000 || scopeYear > 2100)) {
    return NextResponse.json({ error: 'Année invalide' }, { status: 400 });
  }
  if (scope === 'period' && (!scopeStart || !scopeEnd)) {
    return NextResponse.json({ error: 'Période incomplète' }, { status: 400 });
  }

  // Resolve workspace owner (member can invite for the workspace owner)
  const { data: membership } = await supabaseAdmin
    .from('workspace_memberships')
    .select('owner_user_id, role')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const ownerUserId = membership?.owner_user_id || user.id;

  const accessToken = generateAccessToken(36);
  const expiresAt = new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString();

  // IMPORTANT : on insère via userClient (et non supabaseAdmin) car la table
  // accountant_access a un trigger BEFORE INSERT qui force user_id à
  // current_workspace_user_id() — fonction basée sur auth.uid(). Avec le
  // service role il n'y a pas de auth.uid(), donc le trigger écrasait user_id
  // à NULL et violait la contrainte NOT NULL. Le userClient porte le JWT,
  // le trigger résout correctement (membre → owner_user_id du workspace,
  // ou auth.uid() en fallback) et la policy RLS passe.
  const { data: created, error: insertError } = await userClient
    .from('accountant_access')
    .insert({
      accountant_email: accountantEmail,
      accountant_name: accountantName,
      token: accessToken,
      scope,
      scope_year: scope === 'fiscal_year' ? scopeYear : null,
      scope_start: scope === 'period' ? scopeStart : null,
      scope_end: scope === 'period' ? scopeEnd : null,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message || "Impossible de créer l'accès" },
      { status: 400 },
    );
  }

  // Compute scope label for email
  let scopeLabel = 'Toutes les données comptables';
  if (scope === 'fiscal_year') scopeLabel = `Année fiscale ${scopeYear}`;
  if (scope === 'period') {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    scopeLabel = `Du ${fmt(scopeStart!)} au ${fmt(scopeEnd!)}`;
  }

  const expiresLabel = new Date(expiresAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Resolve artisan name
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', ownerUserId)
    .maybeSingle();
  const artisanName = profile?.company_name || profile?.full_name || 'Hellobat';

  const origin =
    request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
  const accessUrl = `${origin.replace(/\/$/, '')}/comptable/${accessToken}`;

  // Send email
  let emailSent = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const fromEmail = resolveFromEmail('Hellobat <comptable@hellobat.app>');
      await resend.emails.send({
        from: fromEmail,
        to: accountantEmail,
        subject: `Accès comptable — ${artisanName}`,
        html: buildAccountantInvitationEmail({
          artisanName,
          accountantName,
          accountantEmail,
          accessUrl,
          expiresAt: expiresLabel,
          scopeLabel,
        }),
      });
      emailSent = true;
    } catch (e) {
      console.error("Erreur d'envoi invitation comptable:", e);
    }
  }

  return NextResponse.json({
    access: created,
    access_url: accessUrl,
    email_sent: emailSent,
  });
}
