import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildReferralInviteEmail } from '@/lib/email-templates';

export const runtime = 'nodejs';

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

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const recipientEmail = String(body?.email || '').trim().toLowerCase();
  const recipientName = String(body?.name || '').trim();
  const customMessage = String(body?.message || '').trim();

  if (!recipientEmail || !recipientEmail.includes('@')) {
    return NextResponse.json({ error: 'Email destinataire invalide.' }, { status: 400 });
  }

  // Get/create the user's referral code
  const { data: code, error: codeError } = await userClient.rpc('get_or_create_referral_code');
  if (codeError || !code) {
    return NextResponse.json({ error: codeError?.message || 'Impossible de generer le code' }, { status: 400 });
  }

  // Get sender profile for email branding
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle();

  const senderName = profile?.full_name || profile?.company_name || user.email || 'Un artisan';
  const companyName = profile?.company_name || senderName;

  // Generate tracking token (used for the open-tracking pixel)
  const tokenBytes = new Uint8Array(24);
  crypto.getRandomValues(tokenBytes);
  const trackingToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
  const referralLink = `${origin.replace(/\/$/, '')}/signup?ref=${code}`;
  const trackingPixelUrl = `${origin.replace(/\/$/, '')}/api/referral/track-open?t=${trackingToken}`;

  // Insert invite first so we can track opens even if email send is async
  const { data: invite, error: insertError } = await userClient
    .from('referral_invites')
    .insert({
      referrer_user_id: user.id,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      subject: `${senderName} vous invite sur Hellobat`,
      message: customMessage,
      tracking_token: trackingToken,
    })
    .select('id, sent_at, tracking_token')
    .single();

  if (insertError || !invite) {
    return NextResponse.json({ error: insertError?.message || 'Impossible de creer l invitation' }, { status: 400 });
  }

  let emailSent = false;
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    const resend = new Resend(resendKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hellobat <equipe@hellobat.app>';
    try {
      const html = buildReferralInviteEmail({
        senderName,
        companyName,
        recipientName,
        customMessage,
        referralLink,
        trackingPixelUrl,
      });
      await resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject: `${senderName} vous offre 2 mois gratuits sur Hellobat`,
        html,
      });
      emailSent = true;
    } catch (e) {
      console.error('Referral email send error:', e);
    }
  }

  return NextResponse.json({
    invite,
    email_sent: emailSent,
    referral_link: referralLink,
  });
}
