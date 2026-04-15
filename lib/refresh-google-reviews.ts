import { createClient } from '@supabase/supabase-js';

const STALE_MS = 24 * 60 * 60 * 1000;

export async function refreshGoogleReviewsIfStale(userId: string, placeId: string | null, lastSyncedAt: string | null) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!apiKey || !serviceKey || !supabaseUrl || !placeId) return;

  if (lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < STALE_MS) return;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,url&language=fr&key=${apiKey}`,
    );
    const json = await res.json();
    if (json.status !== 'OK') return;

    const place = json.result;
    const reviews = (place.reviews ?? []) as Array<{
      author_name: string;
      rating: number;
      text: string;
      time: number;
      profile_photo_url?: string;
    }>;

    const sb = createClient(supabaseUrl, serviceKey);

    await sb.from('profiles').update({
      google_business_name: place.name,
      google_review_link: place.url,
      google_reviews_last_synced_at: new Date().toISOString(),
    }).eq('id', userId);

    if (reviews.length > 0) {
      const rows = reviews.map((r) => ({
        user_id: userId,
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
      await sb.from('reviews').upsert(rows, {
        onConflict: 'user_id,external_source,external_id',
        ignoreDuplicates: false,
      });
    }
  } catch {
    // silent — public site should never break on refresh failure
  }
}
