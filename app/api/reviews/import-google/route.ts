import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function extractPlaceId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed) && !trimmed.includes('/')) return trimmed;
  const m = trimmed.match(/place_id[=:]([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

async function findPlaceFromUrl(url: string, apiKey: string): Promise<string | null> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(url)}&inputtype=textquery&fields=place_id&key=${apiKey}`,
  );
  const json = await res.json();
  return json?.candidates?.[0]?.place_id ?? null;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const inputRaw = (body?.input as string | undefined)?.trim();
  if (!inputRaw) {
    return NextResponse.json({ error: 'input requis (URL ou place_id)' }, { status: 400 });
  }

  let placeId = extractPlaceId(inputRaw);
  if (!placeId) {
    placeId = await findPlaceFromUrl(inputRaw, apiKey);
  }
  if (!placeId) {
    return NextResponse.json(
      { error: 'Impossible de trouver la fiche Google. Vérifiez le lien ou collez le place_id.' },
      { status: 400 },
    );
  }

  const detailsRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,url&language=fr&key=${apiKey}`,
  );
  const details = await detailsRes.json();
  if (details.status !== 'OK') {
    return NextResponse.json(
      { error: `Google API: ${details.status} ${details.error_message ?? ''}`.trim() },
      { status: 400 },
    );
  }

  const place = details.result;
  const reviews = (place.reviews ?? []) as Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
    profile_photo_url?: string;
  }>;

  await sb.from('profiles').update({
    google_place_id: placeId,
    google_business_name: place.name,
    google_review_link: place.url,
    google_reviews_last_synced_at: new Date().toISOString(),
  }).eq('id', user.id);

  const rows = reviews.map((r) => ({
    user_id: user.id,
    client_name: r.author_name,
    rating: r.rating,
    comment: r.text,
    review_date: new Date(r.time * 1000).toISOString(),
    external_source: 'google',
    external_id: `${placeId}:${r.time}`,
    is_published_on_site: true,
    status: 'publie',
    author_avatar_url: r.profile_photo_url ?? null,
  }));

  if (rows.length > 0) {
    await sb.from('reviews').upsert(rows, {
      onConflict: 'user_id,external_source,external_id',
      ignoreDuplicates: false,
    });
  }

  return NextResponse.json({
    imported: rows.length,
    place_id: placeId,
    name: place.name,
    rating: place.rating,
    total: place.user_ratings_total,
  });
}
