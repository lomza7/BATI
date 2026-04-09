import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

// GET /api/rendus/public/[token]
// Public endpoint to fetch campaign + branding for /r/[token].
// Bumps view_count and last_viewed_at on first read of the session.
export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const token = String(params.token || '').trim();
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('rendu_campaigns')
    .select('id, user_id, prefilled_client_name, prefilled_client_email, project_type, status, expires_at, view_count')
    .eq('token', token)
    .maybeSingle();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
  }
  if (campaign.status !== 'active') {
    return NextResponse.json({ error: 'Cette campagne est archivée' }, { status: 410 });
  }
  if (new Date(campaign.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Ce lien a expiré' }, { status: 410 });
  }

  // Bump view counter (best-effort, ignore errors)
  await supabaseAdmin
    .from('rendu_campaigns')
    .update({
      view_count: (campaign.view_count || 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq('id', campaign.id);

  // Resolve branding from the workspace owner profile
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('company_name, full_name, logo_url, company_phone, company_city')
    .eq('id', campaign.user_id)
    .maybeSingle();

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      project_type: campaign.project_type,
      prefilled_client_name: campaign.prefilled_client_name,
      prefilled_client_email: campaign.prefilled_client_email,
    },
    branding: {
      artisan_name: profile?.company_name || profile?.full_name || 'Hellobat',
      logo_url: profile?.logo_url || '',
      phone: profile?.company_phone || '',
      city: profile?.company_city || '',
      accent_color: '#d35400',
    },
  });
}
