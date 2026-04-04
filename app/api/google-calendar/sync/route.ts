import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  authenticateRequest,
  getCalendarConnection,
  googleCalendarFetch,
  GoogleCalendarEvent,
} from '@/lib/google-calendar';

export const runtime = 'nodejs';

// Normalize time to HH:MM:SS (handles HH:MM, HH:MM:SS, etc.)
function normalizeTime(t: string): string {
  const parts = t.split(':');
  return `${(parts[0] || '00').padStart(2, '0')}:${(parts[1] || '00').padStart(2, '0')}:${(parts[2] || '00').padStart(2, '0')}`;
}

function mapCalendarEventToGoogle(event: {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
}): GoogleCalendarEvent {
  const hasTime = event.start_time && event.end_time;

  if (hasTime) {
    const tz = 'Europe/Paris';
    return {
      summary: event.title,
      description: event.description || '',
      start: { dateTime: `${event.start_date}T${normalizeTime(event.start_time!)}`, timeZone: tz },
      end: { dateTime: `${event.end_date || event.start_date}T${normalizeTime(event.end_time!)}`, timeZone: tz },
      extendedProperties: { private: { hellobat_calendar_id: event.id } },
    };
  }

  // All-day: Google end date is exclusive
  const endDate = new Date(event.end_date);
  endDate.setDate(endDate.getDate() + 1);
  const endStr = endDate.toISOString().slice(0, 10);

  return {
    summary: event.title,
    description: event.description || '',
    start: { date: event.start_date },
    end: { date: endStr },
    extendedProperties: { private: { hellobat_calendar_id: event.id } },
  };
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.eventId || !body?.action) {
    return NextResponse.json({ error: 'eventId et action requis' }, { status: 400 });
  }

  const { eventId, action } = body as { eventId: string; action: 'create' | 'update' | 'delete' };

  const conn = await getCalendarConnection(auth.userId);
  if (!conn) {
    return NextResponse.json({ error: 'Google Calendar non connecte' }, { status: 400 });
  }

  const calendarId = encodeURIComponent(conn.calendar_id || 'primary');
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    if (action === 'delete') {
      const { data: event } = await sb
        .from('calendar_events')
        .select('google_event_id')
        .eq('id', eventId)
        .eq('user_id', auth.userId)
        .maybeSingle();

      if (event?.google_event_id) {
        try {
          await googleCalendarFetch(auth.userId, `${baseUrl}/${event.google_event_id}`, { method: 'DELETE' });
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

    const googleBody = mapCalendarEventToGoogle(event);

    if (action === 'create') {
      const created = await googleCalendarFetch<{ id: string }>(
        auth.userId, baseUrl,
        { method: 'POST', body: JSON.stringify(googleBody) },
      );
      await sb.from('calendar_events').update({ google_event_id: created.id }).eq('id', eventId);
      return NextResponse.json({ ok: true, googleEventId: created.id });
    }

    if (action === 'update') {
      const googleEventId = event.google_event_id;
      if (!googleEventId) {
        const created = await googleCalendarFetch<{ id: string }>(
          auth.userId, baseUrl,
          { method: 'POST', body: JSON.stringify(googleBody) },
        );
        await sb.from('calendar_events').update({ google_event_id: created.id }).eq('id', eventId);
        return NextResponse.json({ ok: true, googleEventId: created.id });
      }

      await googleCalendarFetch(auth.userId, `${baseUrl}/${googleEventId}`, {
        method: 'PUT', body: JSON.stringify(googleBody),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur sync Google Calendar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
