import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  authenticateRequest,
  getCalendarConnection,
  googleCalendarFetch,
  GoogleCalendarEvent,
} from '@/lib/google-calendar';

export const runtime = 'nodejs';

interface EventsListResponse {
  items?: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

function mapGoogleToCalendarEvent(gEvent: GoogleCalendarEvent, userId: string) {
  if (!gEvent.id || gEvent.status === 'cancelled') return null;

  const title = gEvent.summary || 'Evenement Google';
  const description = gEvent.description || '';

  let startDate: string;
  let endDate: string;
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (gEvent.start?.date) {
    startDate = gEvent.start.date;
    const end = new Date(gEvent.end?.date || gEvent.start.date);
    end.setDate(end.getDate() - 1); // Google all-day end is exclusive
    endDate = end.toISOString().slice(0, 10);
  } else if (gEvent.start?.dateTime) {
    startDate = gEvent.start.dateTime.slice(0, 10);
    endDate = (gEvent.end?.dateTime || gEvent.start.dateTime).slice(0, 10);
    startTime = gEvent.start.dateTime.slice(11, 16) + ':00';
    endTime = gEvent.end?.dateTime ? gEvent.end.dateTime.slice(11, 16) + ':00' : null;
  } else {
    return null;
  }

  // Determine color from Google colorId (map to our palette)
  const googleColorMap: Record<string, string> = {
    '1': '#6b7280', '2': '#10b981', '3': '#8b5cf6', '4': '#ec4899',
    '5': '#f59e0b', '6': '#ef4444', '7': '#3b82f6', '8': '#6b7280',
    '9': '#3b82f6', '10': '#10b981', '11': '#ef4444',
  };
  const color = googleColorMap[(gEvent as Record<string, unknown>).colorId as string] || '#3b82f6';

  return {
    title,
    description,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    color,
    source: 'google_calendar' as const,
    google_event_id: gEvent.id,
    user_id: userId,
  };
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

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
    let allEvents: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;
    let newSyncToken: string | undefined;
    let usedSyncToken = false;

    do {
      const params = new URLSearchParams({ maxResults: '250', singleEvents: 'true' });

      if (conn.sync_token && !pageToken) {
        params.set('syncToken', conn.sync_token);
        usedSyncToken = true;
      } else if (!conn.sync_token && !pageToken) {
        const timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - 3);
        params.set('timeMin', timeMin.toISOString());
      }

      if (pageToken) params.set('pageToken', pageToken);

      let data: EventsListResponse;
      try {
        data = await googleCalendarFetch<EventsListResponse>(auth.userId, `${baseUrl}?${params.toString()}`);
      } catch (error) {
        if (usedSyncToken && error instanceof Error && error.message.includes('410')) {
          await sb.from('google_calendar_connections').update({ sync_token: null }).eq('user_id', auth.userId);
          const retryParams = new URLSearchParams({ maxResults: '250', singleEvents: 'true' });
          const timeMin = new Date();
          timeMin.setMonth(timeMin.getMonth() - 3);
          retryParams.set('timeMin', timeMin.toISOString());
          data = await googleCalendarFetch<EventsListResponse>(auth.userId, `${baseUrl}?${retryParams.toString()}`);
          usedSyncToken = false;
        } else {
          throw error;
        }
      }

      if (data.items) allEvents = allEvents.concat(data.items);
      pageToken = data.nextPageToken;
      if (data.nextSyncToken) newSyncToken = data.nextSyncToken;
    } while (pageToken);

    let created = 0;
    let updated = 0;
    let deleted = 0;

    for (const gEvent of allEvents) {
      if (!gEvent.id) continue;

      // Skip events that originated from Hellobat
      if (gEvent.extendedProperties?.private?.hellobat_calendar_id) continue;

      const { data: existing } = await sb
        .from('calendar_events')
        .select('id')
        .eq('google_event_id', gEvent.id)
        .eq('user_id', auth.userId)
        .maybeSingle();

      if (gEvent.status === 'cancelled') {
        if (existing) {
          await sb.from('calendar_events').delete().eq('id', existing.id);
          deleted++;
        }
        continue;
      }

      const mapped = mapGoogleToCalendarEvent(gEvent, auth.userId);
      if (!mapped) continue;

      if (existing) {
        const { google_event_id, source, user_id, ...updateFields } = mapped;
        await sb.from('calendar_events').update(updateFields).eq('id', existing.id);
        updated++;
      } else {
        await sb.from('calendar_events').insert(mapped);
        created++;
      }
    }

    await sb.from('google_calendar_connections').update({
      sync_token: newSyncToken || conn.sync_token,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', auth.userId);

    return NextResponse.json({ ok: true, created, updated, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur pull Google Calendar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
