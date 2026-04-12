import { NextResponse } from 'next/server';
import {
  authenticateRequest,
  upsertICloudConnection,
  createDAVClient,
} from '@/lib/icloud-calendar';

export const runtime = 'nodejs';

/**
 * POST /api/icloud-calendar/connect
 * Body: { appleId, appPassword }
 *
 * Validates credentials by attempting a CalDAV login,
 * then stores them in the database.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.appleId || !body?.appPassword) {
    return NextResponse.json(
      { error: 'Identifiant Apple et mot de passe d\'application requis' },
      { status: 400 },
    );
  }

  const { appleId, appPassword } = body as { appleId: string; appPassword: string };

  try {
    // Validate credentials by attempting login
    const testConn = {
      id: '',
      user_id: auth.userId,
      apple_id: appleId,
      app_password: appPassword,
      caldav_url: 'https://caldav.icloud.com',
      calendar_url: null,
      sync_token: null,
      last_synced_at: null,
    };

    const client = await createDAVClient(testConn);
    const calendars = await client.fetchCalendars();

    if (calendars.length === 0) {
      return NextResponse.json(
        { error: 'Aucun calendrier trouve sur ce compte iCloud' },
        { status: 400 },
      );
    }

    // Use the first calendar by default
    const defaultCalendar = calendars[0];

    await upsertICloudConnection(auth.userId, appleId, appPassword, defaultCalendar.url);

    return NextResponse.json({
      ok: true,
      calendars: calendars.map(c => ({
        url: c.url,
        displayName: c.displayName || 'Calendrier',
      })),
      selectedCalendar: defaultCalendar.displayName || 'Calendrier',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Identifiants iCloud invalides';
    return NextResponse.json(
      { error: `Impossible de se connecter a iCloud : ${message}` },
      { status: 401 },
    );
  }
}
