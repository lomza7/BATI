import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleConnectUrl, createGoogleState, setGoogleStateCookie } from '@/lib/google-business';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const state = createGoogleState();
    const response = NextResponse.redirect(buildGoogleConnectUrl(request, state));
    setGoogleStateCookie(response, request, state);
    return response;
  } catch (error) {
    const url = new URL('/avis', request.url);
    url.searchParams.set('google_error', error instanceof Error ? error.message : 'Configuration Google manquante');
    return NextResponse.redirect(url);
  }
}
