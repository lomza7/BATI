import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  authenticateRequest,
  getICloudConnection,
  fetchCalDAVEvents,
  parseICSToEvent,
} from '@/lib/icloud-calendar';

export const runtime = 'nodejs';

/**
 * POST /api/icloud-calendar/pull
 *
 * Pulls events from iCloud CalDAV and upserts them into calendar_events.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const conn = await getICloudConnection(auth.userId);
  if (!conn) {
    return NextResponse.json({ error: 'iCloud Calendar non connecte' }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    const calObjects = await fetchCalDAVEvents(conn);

    let created = 0;
    let updated = 0;

    for (const obj of calObjects) {
      if (!obj.data) continue;

      const mapped = parseICSToEvent(obj.data, auth.userId);
      if (!mapped) continue;

      // Check if event already exists
      const { data: existing } = await sb
        .from('calendar_events')
        .select('id')
        .eq('icloud_event_id', mapped.icloud_event_id)
        .eq('user_id', auth.userId)
        .maybeSingle();

      if (existing) {
        const { icloud_event_id, source, user_id, ...updateFields } = mapped;
        await sb.from('calendar_events').update(updateFields).eq('id', existing.id);
        updated++;
      } else {
        await sb.from('calendar_events').insert(mapped);
        created++;
      }
    }

    // Update last_synced_at
    await sb.from('icloud_calendar_connections').update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', auth.userId);

    return NextResponse.json({ ok: true, created, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur pull iCloud Calendar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
