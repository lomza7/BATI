import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildRenduCampaignEmail } from '@/lib/email-templates';

export const runtime = 'nodejs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';

function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

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
  const clientName = String(body?.client_name || '').trim();
  const clientEmail = String(body?.client_email || '').trim().toLowerCase();
  const projectType = String(body?.project_type || '').trim();
  const sendEmail = Boolean(body?.send_email);

  if (sendEmail && (!clientEmail || !clientEmail.includes('@'))) {
    return NextResponse.json({ error: 'Email du prospect requis pour envoyer' }, { status: 400 });
  }

  const campaignToken = generateToken(32);

  const { data: created, error: insertError } = await userClient
    .from('rendu_campaigns')
    .insert({
      token: campaignToken,
      campaign_name: projectType || 'Campagne Avant/Apres',
      prefilled_client_name: clientName,
      prefilled_client_email: clientEmail,
      project_type: projectType,
    })
    .select('*')
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message || 'Impossible de créer la campagne' },
      { status: 400 },
    );
  }

  const origin =
    request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
  const campaignUrl = `${origin.replace(/\/$/, '')}/r/${campaignToken}`;

  // Resolve workspace owner for branding
  const { data: membership } = await supabaseAdmin
    .from('workspace_memberships')
    .select('owner_user_id')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const ownerUserId = membership?.owner_user_id || user.id;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', ownerUserId)
    .maybeSingle();
  const artisanName = profile?.company_name || profile?.full_name || 'Hellobat';

  let emailSent = false;
  if (sendEmail) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hellobat <noreply@hellobat.app>';
        await resend.emails.send({
          from: fromEmail,
          to: clientEmail,
          subject: `${artisanName} — Visualisez vos travaux avant signature`,
          html: buildRenduCampaignEmail({
            artisanName,
            clientName,
            campaignUrl,
            projectType,
          }),
        });
        emailSent = true;
        await supabaseAdmin
          .from('rendu_campaigns')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', created.id);
      } catch (e) {
        console.error("Erreur d'envoi campagne avant/après:", e);
      }
    }
  }

  return NextResponse.json({
    campaign: created,
    campaign_url: campaignUrl,
    email_sent: emailSent,
  });
}

export async function GET(request: Request) {
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

  // Aggregated stats + campaigns list for the hub view
  const [
    { count: campaignCount },
    { count: leadCount },
    { count: generationCount },
    { data: campaignsRaw },
  ] = await Promise.all([
    userClient.from('rendu_campaigns').select('*', { count: 'exact', head: true }),
    userClient.from('rendu_leads').select('*', { count: 'exact', head: true }),
    userClient.from('rendu_generations').select('*', { count: 'exact', head: true }),
    userClient
      .from('rendu_campaigns')
      .select(
        'id, token, campaign_name, prefilled_client_name, prefilled_client_email, project_type, status, view_count, last_viewed_at, email_sent_at, created_at, expires_at, rendu_leads(count), rendu_generations(count)',
      )
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  type CountRow = { count: number };
  type CampaignRow = {
    id: string;
    token: string;
    campaign_name: string | null;
    prefilled_client_name: string | null;
    prefilled_client_email: string | null;
    project_type: string | null;
    status: string;
    view_count: number | null;
    last_viewed_at: string | null;
    email_sent_at: string | null;
    created_at: string;
    expires_at: string | null;
    rendu_leads?: CountRow[] | null;
    rendu_generations?: CountRow[] | null;
  };

  const campaigns = ((campaignsRaw || []) as CampaignRow[]).map((c) => ({
    id: c.id,
    token: c.token,
    campaign_name: c.campaign_name,
    prefilled_client_name: c.prefilled_client_name,
    prefilled_client_email: c.prefilled_client_email,
    project_type: c.project_type,
    status: c.status,
    view_count: c.view_count || 0,
    last_viewed_at: c.last_viewed_at,
    email_sent_at: c.email_sent_at,
    created_at: c.created_at,
    expires_at: c.expires_at,
    lead_count: c.rendu_leads?.[0]?.count || 0,
    generation_count: c.rendu_generations?.[0]?.count || 0,
  }));

  return NextResponse.json({
    stats: {
      campaigns: campaignCount || 0,
      leads: leadCount || 0,
      generations: generationCount || 0,
    },
    campaigns,
  });
}
