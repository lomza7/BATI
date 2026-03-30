import { NextRequest, NextResponse } from 'next/server';
import { clearGoogleSessionCookie, clearGoogleStateCookie } from '@/lib/google-business';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  clearGoogleSessionCookie(response);
  clearGoogleStateCookie(response);
  return response;
}
