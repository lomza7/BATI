import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleSession,
  setGoogleSessionCookie,
  withUpdatedSelectedLocation,
} from '@/lib/google-business';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getGoogleSession();
    if (!session) {
      return NextResponse.json({ error: 'Connexion Google introuvable' }, { status: 401 });
    }

    const { locationName } = (await request.json()) as { locationName?: string };
    if (!locationName) {
      return NextResponse.json({ error: 'locationName manquant' }, { status: 400 });
    }

    const exists = session.locations.some((location) => location.locationName === locationName);
    if (!exists) {
      return NextResponse.json({ error: 'Fiche Google introuvable' }, { status: 404 });
    }

    const updatedSession = withUpdatedSelectedLocation(session, locationName);
    const response = NextResponse.json({ ok: true });
    setGoogleSessionCookie(response, request, updatedSession);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Impossible de changer de fiche Google' },
      { status: 500 }
    );
  }
}
