import { NextResponse } from 'next/server';
import { authenticateRequest, getICloudConnection } from '@/lib/icloud-calendar';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const conn = await getICloudConnection(auth.userId);

  return NextResponse.json({
    connected: !!conn,
    appleId: conn?.apple_id || null,
    calendarUrl: conn?.calendar_url || null,
    lastSyncedAt: conn?.last_synced_at || null,
  });
}
