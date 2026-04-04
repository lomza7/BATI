import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const GOOGLE_CAL_STATE_COOKIE = 'hellobat_gcal_state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoogleCalendarConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  calendar_id: string;
  sync_token: string | null;
  last_synced_at: string | null;
}

export interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  status?: string;
  extendedProperties?: { private?: Record<string, string> };
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
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
// OAuth helpers
// ---------------------------------------------------------------------------

export function getCalendarRedirectUri(request: NextRequest) {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${request.nextUrl.origin}/api/google-calendar/callback`;
}

export function createCalendarState() {
  return crypto.randomBytes(24).toString('hex');
}

export function buildCalendarConnectUrl(request: NextRequest, state: string) {
  const params = new URLSearchParams({
    client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: getCalendarRedirectUri(request),
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCalendarCode(request: NextRequest, code: string) {
  const params = new URLSearchParams({
    client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
    code,
    grant_type: 'authorization_code',
    redirect_uri: getCalendarRedirectUri(request),
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  const data = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Impossible d obtenir les tokens Google Calendar');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Token management (DB-backed)
// ---------------------------------------------------------------------------

export async function getCalendarConnection(userId: string): Promise<GoogleCalendarConnection | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data as GoogleCalendarConnection | null;
}

export async function upsertCalendarConnection(
  userId: string,
  tokens: GoogleTokenResponse,
  calendarId = 'primary',
) {
  const sb = getSupabaseAdmin();
  const row = {
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || '',
    expires_at: Date.now() + tokens.expires_in * 1000,
    calendar_id: calendarId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb
    .from('google_calendar_connections')
    .upsert(row, { onConflict: 'user_id' });

  if (error) throw new Error(`Erreur upsert connexion: ${error.message}`);
}

async function refreshCalendarTokens(conn: GoogleCalendarConnection): Promise<string> {
  const params = new URLSearchParams({
    client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: conn.refresh_token,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  const data = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Impossible de rafraichir le token Google Calendar');
  }

  const sb = getSupabaseAdmin();
  await sb
    .from('google_calendar_connections')
    .update({
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', conn.user_id);

  return data.access_token;
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const conn = await getCalendarConnection(userId);
  if (!conn) return null;

  if (conn.expires_at > Date.now() + 60_000) {
    return conn.access_token;
  }

  if (!conn.refresh_token) return null;
  return refreshCalendarTokens(conn);
}

// ---------------------------------------------------------------------------
// Google Calendar API fetch wrapper
// ---------------------------------------------------------------------------

export async function googleCalendarFetch<T>(
  userId: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('Google Calendar non connecte');

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (response.status === 204) return {} as T;

  const data = (await response.json()) as T & { error?: { message?: string; code?: number } };
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? data.error?.message : undefined;
    throw new Error(message || `Erreur Google Calendar API (${response.status})`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// State cookie helpers (same pattern as google-business)
// ---------------------------------------------------------------------------

function isSecureCookie(request: NextRequest) {
  return request.nextUrl.protocol === 'https:';
}

export function setCalendarStateCookie(response: NextResponse, request: NextRequest, state: string) {
  response.cookies.set(GOOGLE_CAL_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(request),
    path: '/',
    maxAge: 60 * 10,
  });
}

export function clearCalendarStateCookie(response: NextResponse) {
  response.cookies.set(GOOGLE_CAL_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function readCalendarStateCookie(request: NextRequest) {
  return request.cookies.get(GOOGLE_CAL_STATE_COOKIE)?.value || null;
}

// ---------------------------------------------------------------------------
// Auth helper for API routes
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
