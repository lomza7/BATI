import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchGoogleReviews,
  getGoogleSession,
  getSelectedLocation,
} from '@/lib/google-business';

export const runtime = 'nodejs';

/**
 * Sync des avis Google vers la table reviews locale.
 *
 * - Ecrit/maj chaque avis Google dans `reviews` avec `external_id` = nom Google
 *   et `external_source` = 'google'.
 * - Les nouveaux avis sont publies par defaut sur le site.
 * - Les toggles de publication manuels par l'utilisateur sont preserves
 *   grace au ON CONFLICT DO UPDATE qui ne reecrit PAS is_published_on_site.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  try {
    const session = await getGoogleSession();
    if (!session) {
      return NextResponse.json({ synced: 0, total: 0 });
    }

    const selectedLocation = getSelectedLocation(session);
    if (!selectedLocation) {
      return NextResponse.json({ synced: 0, total: 0 });
    }

    const reviewData = await fetchGoogleReviews(
      selectedLocation.reviewParent,
      session.accessToken
    );

    if (!reviewData.reviews.length) {
      return NextResponse.json({ synced: 0, total: 0 });
    }

    // Recuperer les avis locaux deja synchronises pour cet utilisateur
    // pour preserver le flag is_published_on_site (ne pas ecraser les toggles manuels).
    const { data: existingRows } = await userClient
      .from('reviews')
      .select('id, external_id, is_published_on_site')
      .eq('user_id', user.id)
      .eq('external_source', 'google');

    const existingByExternal = new Map<
      string,
      { id: string; is_published_on_site: boolean }
    >();
    for (const row of existingRows || []) {
      if (row.external_id) {
        existingByExternal.set(row.external_id, {
          id: row.id,
          is_published_on_site: row.is_published_on_site,
        });
      }
    }

    let synced = 0;
    for (const review of reviewData.reviews) {
      const existing = existingByExternal.get(review.name);
      const payload = {
        user_id: user.id,
        client_name: review.reviewerName || 'Client Google',
        rating: Math.max(1, Math.min(5, review.starRating || 5)),
        comment: review.comment || '',
        response: review.reviewReplyComment || '',
        status: review.reviewReplyComment ? 'repondu' : 'publie',
        external_id: review.name,
        external_source: 'google',
        review_date: review.updateTime || review.createTime,
      };

      if (existing) {
        // Preserve le flag is_published_on_site decide manuellement
        const { error } = await userClient
          .from('reviews')
          .update(payload)
          .eq('id', existing.id);
        if (!error) synced++;
      } else {
        // Nouveau : publie par defaut
        const { error } = await userClient.from('reviews').insert({
          ...payload,
          is_published_on_site: true,
        });
        if (!error) synced++;
      }
    }

    return NextResponse.json({
      synced,
      total: reviewData.reviews.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Erreur sync Google reviews',
      },
      { status: 500 }
    );
  }
}
