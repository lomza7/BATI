import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DAVClient, DAVCalendar, DAVObject } from 'tsdav';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ICloudCalendarConnection {
  id: string;
  user_id: string;
  apple_id: string;
  app_password: string;
  caldav_url: string;
  calendar_url: string | null;
  sync_token: string | null;
  last_synced_at: string | null;
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variable ${name} manquante`);
  return value;
}

function getSupabaseAdmin() {
  return createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
}

// ---------------------------------------------------------------------------
// Auth helper (same pattern as google-calendar.ts)
// ---------------------------------------------------------------------------

export async function authenticateRequest(request: Request): Promise<{ userId: string } | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Session utilisateur requise' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const sb = createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
  }

  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

export async function getICloudConnection(userId: string): Promise<ICloudCalendarConnection | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('icloud_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data as ICloudCalendarConnection | null;
}

export async function upsertICloudConnection(
  userId: string,
  appleId: string,
  appPassword: string,
  calendarUrl: string | null,
) {
  const sb = getSupabaseAdmin();
  const row = {
    user_id: userId,
    apple_id: appleId,
    app_password: appPassword,
    caldav_url: 'https://caldav.icloud.com',
    calendar_url: calendarUrl,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb
    .from('icloud_calendar_connections')
    .upsert(row, { onConflict: 'user_id' });

  if (error) throw new Error(`Erreur upsert connexion iCloud: ${error.message}`);
}

// ---------------------------------------------------------------------------
// CalDAV client factory
// ---------------------------------------------------------------------------

export async function createDAVClient(conn: ICloudCalendarConnection): Promise<DAVClient> {
  const client = new DAVClient({
    serverUrl: conn.caldav_url,
    credentials: {
      username: conn.apple_id,
      password: conn.app_password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  await client.login();
  return client;
}

// ---------------------------------------------------------------------------
// Calendar discovery
// ---------------------------------------------------------------------------

export async function discoverCalendars(conn: ICloudCalendarConnection): Promise<DAVCalendar[]> {
  const client = await createDAVClient(conn);
  const calendars = await client.fetchCalendars();
  return calendars;
}

// ---------------------------------------------------------------------------
// iCal (ICS) helpers
// ---------------------------------------------------------------------------

function escapeICalText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function normalizeTime(t: string): string {
  const parts = t.split(':');
  return `${(parts[0] || '00').padStart(2, '0')}${(parts[1] || '00').padStart(2, '0')}00`;
}

export function calendarEventToICS(event: {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
}): string {
  const uid = `hellobat-${event.id}@hellobat.app`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  let dtstart: string;
  let dtend: string;

  if (event.start_time && event.end_time) {
    const startDate = event.start_date.replace(/-/g, '');
    const endDate = (event.end_date || event.start_date).replace(/-/g, '');
    dtstart = `DTSTART;TZID=Europe/Paris:${startDate}T${normalizeTime(event.start_time)}`;
    dtend = `DTEND;TZID=Europe/Paris:${endDate}T${normalizeTime(event.end_time)}`;
  } else {
    const startDate = event.start_date.replace(/-/g, '');
    // All-day: end date is exclusive in iCal
    const end = new Date(event.end_date || event.start_date);
    end.setDate(end.getDate() + 1);
    const endDate = end.toISOString().slice(0, 10).replace(/-/g, '');
    dtstart = `DTSTART;VALUE=DATE:${startDate}`;
    dtend = `DTEND;VALUE=DATE:${endDate}`;
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hellobat//CalDAV//FR',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeICalText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeICalText(event.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

// ---------------------------------------------------------------------------
// Parse ICS to our event format
// ---------------------------------------------------------------------------

function parseICalDate(value: string): { date: string; time: string | null } {
  // Format: 20260415T140000 or 20260415
  const cleaned = value.replace(/Z$/, '');
  if (cleaned.includes('T')) {
    const date = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    const time = `${cleaned.slice(9, 11)}:${cleaned.slice(11, 13)}:${cleaned.slice(13, 15)}`;
    return { date, time };
  }
  return { date: `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`, time: null };
}

function getICalProp(ics: string, prop: string): string | null {
  // Match property, optionally with parameters like DTSTART;TZID=...:value
  const regex = new RegExp(`^${prop}[;:](.*)$`, 'm');
  const match = ics.match(regex);
  if (!match) return null;
  // Extract value after the last colon (in case of params)
  const line = match[1];
  const colonIdx = line.lastIndexOf(':');
  return colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : line.trim();
}

function getICalUID(ics: string): string | null {
  const match = ics.match(/^UID:(.+)$/m);
  return match ? match[1].trim() : null;
}

function getICalSummary(ics: string): string {
  const match = ics.match(/^SUMMARY:(.+)$/m);
  return match ? match[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';') : 'Evenement iCloud';
}

function getICalDescription(ics: string): string {
  const match = ics.match(/^DESCRIPTION:(.+)$/m);
  return match ? match[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';') : '';
}

export function parseICSToEvent(ics: string, userId: string) {
  const uid = getICalUID(ics);
  if (!uid) return null;

  // Skip Hellobat-originated events to prevent loops
  if (uid.startsWith('hellobat-') && uid.endsWith('@hellobat.app')) return null;

  const title = getICalSummary(ics);
  const description = getICalDescription(ics);

  const dtStartRaw = getICalProp(ics, 'DTSTART');
  const dtEndRaw = getICalProp(ics, 'DTEND');

  if (!dtStartRaw) return null;

  const start = parseICalDate(dtStartRaw);
  const end = dtEndRaw ? parseICalDate(dtEndRaw) : { ...start };

  // If all-day, iCal end date is exclusive — subtract one day
  let endDate = end.date;
  if (!start.time && !end.time && dtEndRaw) {
    const d = new Date(end.date);
    d.setDate(d.getDate() - 1);
    endDate = d.toISOString().slice(0, 10);
  }

  return {
    title,
    description,
    start_date: start.date,
    end_date: endDate,
    start_time: start.time,
    end_time: end.time,
    color: '#a855f7', // Purple for iCloud events
    source: 'icloud_calendar' as const,
    icloud_event_id: uid,
    user_id: userId,
  };
}

// ---------------------------------------------------------------------------
// Fetch all events from a CalDAV calendar
// ---------------------------------------------------------------------------

export async function fetchCalDAVEvents(conn: ICloudCalendarConnection): Promise<DAVObject[]> {
  const client = await createDAVClient(conn);

  // Fetch events from the last 3 months to 1 year ahead
  const timeMin = new Date();
  timeMin.setMonth(timeMin.getMonth() - 3);
  const timeRange = {
    start: timeMin.toISOString(),
    end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  // Pull from ALL calendars to capture all events
  const calendars = await client.fetchCalendars();
  if (calendars.length === 0) throw new Error('Aucun calendrier trouve sur iCloud');

  const allObjects: DAVObject[] = [];
  for (const cal of calendars) {
    try {
      const objects = await client.fetchCalendarObjects({
        calendar: cal,
        timeRange,
      });
      allObjects.push(...objects);
    } catch {
      // Skip calendars that fail (e.g. shared calendars with no read access)
    }
  }

  return allObjects;
}

// ---------------------------------------------------------------------------
// Push a single event to CalDAV
// ---------------------------------------------------------------------------

export async function pushEventToCalDAV(
  conn: ICloudCalendarConnection,
  event: {
    id: string;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
  },
): Promise<string> {
  const client = await createDAVClient(conn);

  if (!conn.calendar_url) {
    const calendars = await client.fetchCalendars();
    if (calendars.length === 0) throw new Error('Aucun calendrier trouve sur iCloud');
    conn.calendar_url = calendars[0].url;
  }

  const icsData = calendarEventToICS(event);
  const uid = `hellobat-${event.id}@hellobat.app`;
  const filename = `${uid}.ics`;

  await client.createCalendarObject({
    calendar: { url: conn.calendar_url } as DAVCalendar,
    filename,
    iCalString: icsData,
  });

  return uid;
}

// ---------------------------------------------------------------------------
// Update a CalDAV event
// ---------------------------------------------------------------------------

export async function updateEventOnCalDAV(
  conn: ICloudCalendarConnection,
  event: {
    id: string;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
  },
  icloudEventId: string,
): Promise<void> {
  const client = await createDAVClient(conn);

  if (!conn.calendar_url) {
    const calendars = await client.fetchCalendars();
    if (calendars.length === 0) throw new Error('Aucun calendrier trouve sur iCloud');
    conn.calendar_url = calendars[0].url;
  }

  const icsData = calendarEventToICS(event);
  const filename = `${icloudEventId}.ics`;

  await client.updateCalendarObject({
    calendarObject: {
      url: `${conn.calendar_url}${filename}`,
      data: icsData,
    },
  });
}

// ---------------------------------------------------------------------------
// Delete a CalDAV event
// ---------------------------------------------------------------------------

export async function deleteEventFromCalDAV(
  conn: ICloudCalendarConnection,
  icloudEventId: string,
): Promise<void> {
  const client = await createDAVClient(conn);

  if (!conn.calendar_url) {
    const calendars = await client.fetchCalendars();
    if (calendars.length === 0) return;
    conn.calendar_url = calendars[0].url;
  }

  const filename = `${icloudEventId}.ics`;

  await client.deleteCalendarObject({
    calendarObject: {
      url: `${conn.calendar_url}${filename}`,
    },
  });
}
