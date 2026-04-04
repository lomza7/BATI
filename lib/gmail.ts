import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

export const GMAIL_STATE_COOKIE = 'hellobat_gmail_state';
export const GMAIL_USER_COOKIE = 'hellobat_gmail_uid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GmailConnection {
  id: string;
  user_id: string;
  email_address: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface GmailMessageHeader {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  labelIds: string[];
  isUnread: boolean;
  isStarred: boolean;
}

export interface GmailMessageFull extends GmailMessageHeader {
  body: string;
  cc: string;
  replyTo: string;
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

export function getGmailRedirectUri(request: NextRequest) {
  return process.env.GMAIL_REDIRECT_URI || `${request.nextUrl.origin}/api/gmail/callback`;
}

export function createGmailState() {
  return crypto.randomBytes(24).toString('hex');
}

export function buildGmailConnectUrl(request: NextRequest, state: string) {
  const params = new URLSearchParams({
    client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: getGmailRedirectUri(request),
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGmailCode(request: NextRequest, code: string) {
  const params = new URLSearchParams({
    client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
    code,
    grant_type: 'authorization_code',
    redirect_uri: getGmailRedirectUri(request),
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  const data = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Impossible d obtenir les tokens Gmail');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Token management (DB-backed)
// ---------------------------------------------------------------------------

export async function getGmailConnection(userId: string): Promise<GmailConnection | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('gmail_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data as GmailConnection | null;
}

export async function upsertGmailConnection(
  userId: string,
  tokens: GoogleTokenResponse,
  emailAddress: string = '',
) {
  const sb = getSupabaseAdmin();
  const row = {
    user_id: userId,
    email_address: emailAddress,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || '',
    expires_at: Date.now() + tokens.expires_in * 1000,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb
    .from('gmail_connections')
    .upsert(row, { onConflict: 'user_id' });

  if (error) throw new Error(`Erreur upsert connexion Gmail: ${error.message}`);
}

async function refreshGmailTokens(conn: GmailConnection): Promise<string> {
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
    throw new Error(data.error_description || data.error || 'Impossible de rafraichir le token Gmail');
  }

  const sb = getSupabaseAdmin();
  await sb
    .from('gmail_connections')
    .update({
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', conn.user_id);

  return data.access_token;
}

export async function getValidGmailToken(userId: string): Promise<string | null> {
  const conn = await getGmailConnection(userId);
  if (!conn) return null;

  if (conn.expires_at > Date.now() + 60_000) {
    return conn.access_token;
  }

  if (!conn.refresh_token) return null;
  return refreshGmailTokens(conn);
}

// ---------------------------------------------------------------------------
// Gmail API fetch wrapper
// ---------------------------------------------------------------------------

export async function gmailFetch<T>(
  userId: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const accessToken = await getValidGmailToken(userId);
  if (!accessToken) throw new Error('Gmail non connecte');

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
    throw new Error(message || `Erreur Gmail API (${response.status})`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Gmail message parsing helpers
// ---------------------------------------------------------------------------

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractBody(payload: { mimeType?: string; body?: { data?: string; size?: number }; parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }> }): string {
  // Try to find text/html first, then text/plain
  if (payload.parts) {
    // Multipart message
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part as typeof payload);
        if (nested) return nested;
      }
    }
  }

  // Single part message
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  return '';
}

export function parseMessageToHeader(msg: {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  payload?: { headers: { name: string; value: string }[] };
}): GmailMessageHeader {
  const headers = msg.payload?.headers || [];
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject') || '(sans objet)',
    snippet: msg.snippet || '',
    date: getHeader(headers, 'Date'),
    labelIds: msg.labelIds || [],
    isUnread: (msg.labelIds || []).includes('UNREAD'),
    isStarred: (msg.labelIds || []).includes('STARRED'),
  };
}

export function parseMessageFull(msg: {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  payload: { headers: { name: string; value: string }[]; mimeType?: string; body?: { data?: string; size?: number }; parts?: unknown[] };
}): GmailMessageFull {
  const headers = msg.payload.headers;
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc'),
    replyTo: getHeader(headers, 'Reply-To'),
    subject: getHeader(headers, 'Subject') || '(sans objet)',
    snippet: msg.snippet || '',
    date: getHeader(headers, 'Date'),
    labelIds: msg.labelIds || [],
    isUnread: (msg.labelIds || []).includes('UNREAD'),
    isStarred: (msg.labelIds || []).includes('STARRED'),
    body: extractBody(msg.payload as Parameters<typeof extractBody>[0]),
  };
}

// ---------------------------------------------------------------------------
// Build raw RFC 2822 email for sending
// ---------------------------------------------------------------------------

// Encode header value for non-ASCII characters (RFC 2047)
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}

export function buildRawEmail(opts: {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${encodeHeader(opts.subject)}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.references || opts.inReplyTo}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(opts.body, 'utf-8').toString('base64'),
  ];
  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

// ---------------------------------------------------------------------------
// Auth helper for API routes
// ---------------------------------------------------------------------------

export async function authenticateGmailRequest(request: Request): Promise<{ userId: string } | NextResponse> {
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
// State cookie helpers
// ---------------------------------------------------------------------------

function isSecureCookie(request: NextRequest) {
  return request.nextUrl.protocol === 'https:';
}

export function setGmailStateCookie(response: NextResponse, request: NextRequest, state: string) {
  response.cookies.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(request),
    path: '/',
    maxAge: 60 * 10,
  });
}

export function clearGmailStateCookie(response: NextResponse) {
  response.cookies.set(GMAIL_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function readGmailStateCookie(request: NextRequest) {
  return request.cookies.get(GMAIL_STATE_COOKIE)?.value || null;
}
