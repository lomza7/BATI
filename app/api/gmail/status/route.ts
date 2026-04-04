import { NextResponse } from 'next/server';
import { authenticateGmailRequest, getGmailConnection } from '@/lib/gmail';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await authenticateGmailRequest(request);
  if (auth instanceof NextResponse) return auth;

  const conn = await getGmailConnection(auth.userId);
  return NextResponse.json({
    connected: !!conn,
    emailAddress: conn?.email_address || null,
  });
}
