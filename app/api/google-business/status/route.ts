import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGoogleReviews,
  getGoogleSession,
  getSelectedLocation,
  readGoogleSessionCookie,
  setGoogleSessionCookie,
} from '@/lib/google-business';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const initialSession = readGoogleSessionCookie();
    const session = await getGoogleSession();

    if (!session) {
      return NextResponse.json({
        connected: false,
        locations: [],
        selectedLocation: null,
        reviews: [],
        averageRating: 0,
        totalReviewCount: 0,
      });
    }

    const selectedLocation = getSelectedLocation(session);
    const reviewData = selectedLocation
      ? await fetchGoogleReviews(selectedLocation.reviewParent, session.accessToken)
      : { reviews: [], averageRating: 0, totalReviewCount: 0 };

    const response = NextResponse.json({
      connected: true,
      locations: session.locations,
      selectedLocation,
      reviews: reviewData.reviews,
      averageRating: reviewData.averageRating,
      totalReviewCount: reviewData.totalReviewCount,
    });

    if (!initialSession || initialSession.accessToken !== session.accessToken || initialSession.expiresAt !== session.expiresAt) {
      setGoogleSessionCookie(response, request, session);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : 'Impossible de lire la connexion Google',
      },
      { status: 500 }
    );
  }
}
