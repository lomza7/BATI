import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { WORKSPACE_ROLE_LABELS, WORKSPACE_ROLE_OPTIONS, canManageWorkspaceTeam } from '@/lib/workspace';

export const runtime = 'nodejs';

const ALLOWED_ROLES = new Set(WORKSPACE_ROLE_OPTIONS.map((option) => option.value));

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Session utilisateur requise' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 503 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const invitedEmail = String(body?.email || '').trim().toLowerCase();
  const role = String(body?.role || 'commercial').trim() as (typeof WORKSPACE_ROLE_OPTIONS)[number]['value'];
  const note = String(body?.note || '').trim();

  if (!invitedEmail || !invitedEmail.includes('@')) {
    return NextResponse.json({ error: 'Merci de renseigner un email valide.' }, { status: 400 });
  }

  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: 'Role invalide.' }, { status: 400 });
  }

  const { data: currentMembership } = await supabaseAdmin
    .from('workspace_memberships')
    .select('owner_user_id, role')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const workspaceOwnerId = currentMembership?.owner_user_id || user.id;
  const requesterRole = currentMembership?.role || 'owner';

  if (!canManageWorkspaceTeam(requesterRole)) {
    return NextResponse.json(
      { error: "Seuls le dirigeant et les admins peuvent inviter des comptes d'equipe." },
      { status: 403 }
    );
  }

  const { data: ownerProfile, error: ownerProfileError } = await supabaseAdmin
    .from('profiles')
    .select('company_name, plan')
    .eq('id', workspaceOwnerId)
    .maybeSingle();

  if (ownerProfileError) {
    return NextResponse.json({ error: ownerProfileError.message }, { status: 400 });
  }

  if (!ownerProfile || ownerProfile.plan === 'starter') {
    return NextResponse.json(
      { error: "Les comptes d'equipe sont reserves aux offres payantes." },
      { status: 403 }
    );
  }

  if (invitedEmail === user.email?.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Vous etes deja connecte avec cet email. Invitez plutot un autre compte." },
      { status: 400 }
    );
  }

  const { data: existingMembership } = await supabaseAdmin
    .from('workspace_memberships')
    .select('*')
    .eq('owner_user_id', workspaceOwnerId)
    .eq('invited_email', invitedEmail)
    .maybeSingle();

  const inviteToken = crypto.randomUUID();

  const payload = {
    owner_user_id: workspaceOwnerId,
    invited_email: invitedEmail,
    role,
    note,
    invited_by: user.id,
    invite_token: inviteToken,
    status: existingMembership?.member_user_id ? existingMembership.status : 'pending',
    member_user_id: existingMembership?.status === 'active' ? existingMembership.member_user_id : null,
    accepted_at: existingMembership?.status === 'active' ? existingMembership.accepted_at : null,
    last_seen_at: existingMembership?.status === 'active' ? existingMembership.last_seen_at : null,
    last_active_path: existingMembership?.status === 'active' ? existingMembership.last_active_path : '',
    updated_at: new Date().toISOString(),
  };

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('workspace_memberships')
    .upsert(payload, { onConflict: 'owner_user_id,invited_email' })
    .select('*')
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ error: membershipError?.message || 'Impossible de creer l invitation.' }, { status: 400 });
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const loginUrl = `${origin.replace(/\/$/, '')}/login?email=${encodeURIComponent(invitedEmail)}&team=1`;
  const signupUrl = `${origin.replace(/\/$/, '')}/signup?email=${encodeURIComponent(invitedEmail)}&team=1`;

  let emailSent = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hellobat <equipe@hellobat.app>';
    const companyName = ownerProfile.company_name || 'votre entreprise';

    try {
      await resend.emails.send({
        from: fromEmail,
        to: invitedEmail,
        subject: `Invitation Hellobat - ${companyName}`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px;background:#f7f4ef;color:#18120f">
            <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #eadfd3;border-radius:18px;padding:28px">
              <p style="margin:0 0 12px;font-size:14px;color:#8a6a55">Invitation d'equipe</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25">Vous etes invite a rejoindre l'espace ${companyName}</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#5f4a3d">
                Role propose : <strong>${WORKSPACE_ROLE_LABELS[role]}</strong>${note ? `<br/>Note : ${note}` : ''}
              </p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#5f4a3d">
                Si vous avez deja un compte, connectez-vous avec cet email. Sinon, creez votre acces en quelques secondes.
              </p>
              <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px">
                <a href="${loginUrl}" style="background:#d96526;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">Se connecter</a>
                <a href="${signupUrl}" style="background:#fff;color:#d96526;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600;border:1px solid #f0d2bf">Creer mon acces</a>
              </div>
            </div>
          </div>
        `,
      });
      emailSent = true;
    } catch (error) {
      console.error("Erreur d'envoi d'invitation equipe:", error);
    }
  }

  return NextResponse.json({
    membership,
    login_url: loginUrl,
    signup_url: signupUrl,
    email_sent: emailSent,
  });
}
