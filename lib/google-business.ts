import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const GOOGLE_BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';
export const GOOGLE_STATE_COOKIE = 'hellobat_google_state';
export const GOOGLE_SESSION_COOKIE = 'hellobat_google_business';

export interface GoogleBusinessLocation {
  accountName: string;
  accountDisplayName: string;
  locationName: string;
  reviewParent: string;
  title: string;
  websiteUri: string;
  mapsUri: string;
  newReviewUri: string;
  placeId: string;
}

export interface GoogleBusinessReview {
  name: string;
  reviewerName: string;
  comment: string;
  starRating: number;
  updateTime: string;
  createTime: string;
  reviewReplyComment: string;
  reviewReplyUpdateTime: string;
}

export interface GoogleBusinessSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  locations: GoogleBusinessLocation[];
  selectedLocationName: string | null;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleAccount {
  name: string;
  accountName?: string;
  type?: string;
}

interface GoogleLocationListResponse {
  locations?: Array<{
    name: string;
    title?: string;
    websiteUri?: string;
    metadata?: {
      mapsUri?: string;
      newReviewUri?: string;
      placeId?: string;
    };
  }>;
  nextPageToken?: string;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable ${name} manquante`);
  }
  return value;
}

function getEncryptionKey() {
  const secret = process.env.GOOGLE_INTEGRATION_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error('Variable GOOGLE_INTEGRATION_SECRET ou GOOGLE_CLIENT_SECRET manquante');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(text: string) {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(payload: string) {
  const [ivB64, tagB64, encryptedB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Cookie Google invalide');
  }

  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const encrypted = Buffer.from(encryptedB64, 'base64url');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function isSecureCookie(request: NextRequest) {
  return request.nextUrl.protocol === 'https:';
}

export function getGoogleRedirectUri(request: NextRequest) {
  return process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/google-business/callback`;
}

export function createGoogleState() {
  return crypto.randomBytes(24).toString('hex');
}

export function buildGoogleConnectUrl(request: NextRequest, state: string) {
  const params = new URLSearchParams({
    client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: getGoogleRedirectUri(request),
    response_type: 'code',
    scope: GOOGLE_BUSINESS_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(request: NextRequest, code: string) {
  const params = new URLSearchParams({
    client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
    code,
    grant_type: 'authorization_code',
    redirect_uri: getGoogleRedirectUri(request),
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  const data = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Impossible d obtenir les tokens Google');
  }

  return data;
}

async function refreshGoogleTokens(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: refreshToken,
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
    throw new Error(data.error_description || data.error || 'Impossible de rafraichir le token Google');
  }

  return data;
}

async function googleJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? data.error?.message : undefined;
    throw new Error(message || `Erreur Google API (${response.status})`);
  }

  return data;
}

async function fetchGoogleAccounts(accessToken: string) {
  const data = await googleJson<{ accounts?: GoogleAccount[] }>(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    accessToken
  );

  return data.accounts || [];
}

async function fetchLocationsForAccount(account: GoogleAccount, accessToken: string) {
  const params = new URLSearchParams({
    pageSize: '100',
    readMask: 'name,title,websiteUri,metadata',
  });

  const data = await googleJson<GoogleLocationListResponse>(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?${params.toString()}`,
    accessToken
  );

  return (data.locations || []).map((location) => ({
    accountName: account.name,
    accountDisplayName: account.accountName || account.name,
    locationName: location.name,
    reviewParent: `${account.name}/${location.name}`,
    title: location.title || 'Fiche sans nom',
    websiteUri: location.websiteUri || '',
    mapsUri: location.metadata?.mapsUri || '',
    newReviewUri: location.metadata?.newReviewUri || '',
    placeId: location.metadata?.placeId || '',
  }));
}

export async function fetchGoogleLocations(accessToken: string) {
  const accounts = await fetchGoogleAccounts(accessToken);
  const locationGroups = await Promise.all(accounts.map((account) => fetchLocationsForAccount(account, accessToken)));
  return locationGroups.flat().filter((location) => location.newReviewUri || location.mapsUri || location.placeId);
}

export async function fetchGoogleReviews(reviewParent: string, accessToken: string) {
  const params = new URLSearchParams({
    pageSize: '50',
    orderBy: 'updateTime desc',
  });

  const data = await googleJson<{
    reviews?: Array<{
      name: string;
      comment?: string;
      starRating?: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
      createTime?: string;
      updateTime?: string;
      reviewer?: { displayName?: string };
      reviewReply?: { comment?: string; updateTime?: string };
    }>;
    averageRating?: number;
    totalReviewCount?: number;
  }>(`https://mybusiness.googleapis.com/v4/${reviewParent}/reviews?${params.toString()}`, accessToken);

  const starMap = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  } as const;

  const reviews: GoogleBusinessReview[] = (data.reviews || []).map((review) => ({
    name: review.name,
    reviewerName: review.reviewer?.displayName || 'Client Google',
    comment: review.comment || '',
    starRating: review.starRating ? starMap[review.starRating] : 0,
    updateTime: review.updateTime || '',
    createTime: review.createTime || '',
    reviewReplyComment: review.reviewReply?.comment || '',
    reviewReplyUpdateTime: review.reviewReply?.updateTime || '',
  }));

  return {
    reviews,
    averageRating: data.averageRating || 0,
    totalReviewCount: data.totalReviewCount || reviews.length,
  };
}

export async function updateGoogleReviewReply(reviewName: string, comment: string, accessToken: string) {
  return googleJson(
    `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({ comment }),
    }
  );
}

export async function createGoogleSessionFromCode(request: NextRequest, code: string) {
  const tokenData = await exchangeCodeForTokens(request, code);
  const locations = await fetchGoogleLocations(tokenData.access_token);

  const selectedLocationName = locations[0]?.locationName || null;

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || '',
    expiresAt: Date.now() + tokenData.expires_in * 1000,
    locations,
    selectedLocationName,
  } satisfies GoogleBusinessSession;
}

export function setGoogleStateCookie(response: NextResponse, request: NextRequest, state: string) {
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(request),
    path: '/',
    maxAge: 60 * 10,
  });
}

export function clearGoogleStateCookie(response: NextResponse) {
  response.cookies.set(GOOGLE_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function readGoogleStateCookie() {
  return cookies().get(GOOGLE_STATE_COOKIE)?.value || null;
}

export function setGoogleSessionCookie(response: NextResponse, request: NextRequest, session: GoogleBusinessSession) {
  response.cookies.set(GOOGLE_SESSION_COOKIE, encrypt(JSON.stringify(session)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(request),
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearGoogleSessionCookie(response: NextResponse) {
  response.cookies.set(GOOGLE_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function readGoogleSessionCookie() {
  const raw = cookies().get(GOOGLE_SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(decrypt(raw)) as GoogleBusinessSession;
  } catch {
    return null;
  }
}

export async function getGoogleSession() {
  const session = readGoogleSessionCookie();
  if (!session) return null;

  if (session.expiresAt > Date.now() + 60_000) {
    return session;
  }

  if (!session.refreshToken) {
    return null;
  }

  const tokenData = await refreshGoogleTokens(session.refreshToken);
  return {
    ...session,
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  } satisfies GoogleBusinessSession;
}

export function getSelectedLocation(session: GoogleBusinessSession | null) {
  if (!session) return null;
  if (!session.selectedLocationName) return session.locations[0] || null;
  return session.locations.find((location) => location.locationName === session.selectedLocationName) || session.locations[0] || null;
}

export function withUpdatedSelectedLocation(session: GoogleBusinessSession, locationName: string) {
  return {
    ...session,
    selectedLocationName: locationName,
  } satisfies GoogleBusinessSession;
}
