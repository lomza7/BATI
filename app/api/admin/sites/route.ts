import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/admin';

export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use service role to bypass RLS
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: sites, error } = await adminClient
    .from('artisan_sites')
    .select(`
      id,
      slug,
      status,
      theme,
      show_services,
      show_projects,
      show_reviews,
      show_contact,
      published_at,
      created_at,
      updated_at,
      user_id
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch profile info for each site owner
  const userIds = Array.from(new Set((sites || []).map(s => s.user_id)));
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, company_name, company_city, company_activity')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  const enriched = (sites || []).map(site => ({
    ...site,
    company_name: profileMap.get(site.user_id)?.company_name || '—',
    company_city: profileMap.get(site.user_id)?.company_city || '',
    company_activity: profileMap.get(site.user_id)?.company_activity || '',
  }));

  return NextResponse.json({ sites: enriched });
}
