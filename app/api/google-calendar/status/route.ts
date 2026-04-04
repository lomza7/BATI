import { NextResponse } from 'next/server';
import { authenticateRequest, getCalendarConnection } from '@/lib/google-calendar';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const conn = await getCalendarConnection(auth.userId);

  return NextResponse.json({
    connected: !!conn,
    calendarId: conn?.calendar_id || null,
    lastSyncedAt: conn?.last_synced_at || null,
  });
}
