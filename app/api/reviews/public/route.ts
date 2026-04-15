import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 });

  const { data } = await sbAdmin
    .from('profiles')
    .select('id, company_name, logo_url')
    .eq('public_review_token', token)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  return NextResponse.json({
    company_name: data.company_name,
    logo_url: data.logo_url,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, client_name, client_email, rating, comment } = body ?? {};

  if (!token || !client_name || !rating) {
    return NextResponse.json({ error: 'champs requis manquants' }, { status: 400 });
  }
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return NextResponse.json({ error: 'note invalide' }, { status: 400 });
  }

  const { data: profile } = await sbAdmin
    .from('profiles')
    .select('id')
    .eq('public_review_token', token)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: 'introuvable' }, { status: 404 });

  const { error } = await sbAdmin.from('reviews').insert({
    user_id: profile.id,
    client_name: String(client_name).slice(0, 120),
    client_email: client_email ? String(client_email).slice(0, 200) : null,
    rating: r,
    comment: comment ? String(comment).slice(0, 2000) : null,
    review_date: new Date().toISOString(),
    external_source: 'public',
    is_published_on_site: false,
    status: 'en_attente',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
