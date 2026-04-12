import { NextResponse } from 'next/server';
import {
  authenticateRequest,
  getICloudConnection,
  discoverCalendars,
} from '@/lib/icloud-calendar';

export const runtime = 'nodejs';

/**
 * GET /api/icloud-calendar/calendars
 *
 * Lists available calendars on the connected iCloud account.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const conn = await getICloudConnection(auth.userId);
  if (!conn) {
    return NextResponse.json({ error: 'iCloud Calendar non connecte' }, { status: 400 });
  }

  try {
    const calendars = await discoverCalendars(conn);

    return NextResponse.json({
      calendars: calendars.map(c => ({
        url: c.url,
        displayName: c.displayName || 'Calendrier',
      })),
      selected: conn.calendar_url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur lecture calendriers iCloud';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
