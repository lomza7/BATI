import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  authenticateRequest,
  getICloudConnection,
  pushEventToCalDAV,
  updateEventOnCalDAV,
  deleteEventFromCalDAV,
} from '@/lib/icloud-calendar';

export const runtime = 'nodejs';

/**
 * POST /api/icloud-calendar/sync
 * Body: { eventId, action: 'create' | 'update' | 'delete' }
 *
 * Pushes a Hellobat calendar event to iCloud via CalDAV.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.eventId || !body?.action) {
    return NextResponse.json({ error: 'eventId et action requis' }, { status: 400 });
  }

  const { eventId, action } = body as { eventId: string; action: 'create' | 'update' | 'delete' };

  const conn = await getICloudConnection(auth.userId);
  if (!conn) {
    return NextResponse.json({ error: 'iCloud Calendar non connecte' }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    if (action === 'delete') {
      const { data: event } = await sb
        .from('calendar_events')
        .select('icloud_event_id')
        .eq('id', eventId)
        .eq('user_id', auth.userId)
        .maybeSingle();

      if (event?.icloud_event_id) {
        try {
          await deleteEventFromCalDAV(conn, event.icloud_event_id);
        } catch { /* may already be deleted */ }
      }

      return NextResponse.json({ ok: true });
    }

    const { data: event } = await sb
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (!event) {
      return NextResponse.json({ error: 'Evenement introuvable' }, { status: 404 });
    }

    if (action === 'create') {
      const icloudEventId = await pushEventToCalDAV(conn, event);
      await sb.from('calendar_events').update({ icloud_event_id: icloudEventId }).eq('id', eventId);
      return NextResponse.json({ ok: true, icloudEventId });
    }

    if (action === 'update') {
      const icloudEventId = event.icloud_event_id;
      if (!icloudEventId) {
        // Event not yet on iCloud — create it
        const newId = await pushEventToCalDAV(conn, event);
        await sb.from('calendar_events').update({ icloud_event_id: newId }).eq('id', eventId);
        return NextResponse.json({ ok: true, icloudEventId: newId });
      }

      await updateEventOnCalDAV(conn, event, icloudEventId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur sync iCloud Calendar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
