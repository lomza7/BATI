import { NextResponse } from 'next/server';
import { authenticateGmailRequest, gmailFetch, parseMessageFull } from '@/lib/gmail';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await authenticateGmailRequest(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const msg = await gmailFetch<{
      id: string; threadId: string; snippet: string; labelIds?: string[];
      payload: { headers: { name: string; value: string }[]; mimeType?: string; body?: { data?: string; size?: number }; parts?: unknown[] };
    }>(auth.userId, `https://www.googleapis.com/gmail/v1/users/me/messages/${params.id}?format=full`);

    const parsed = parseMessageFull(msg);

    // Mark as read
    try {
      await gmailFetch(auth.userId, `https://www.googleapis.com/gmail/v1/users/me/messages/${params.id}/modify`, {
        method: 'POST',
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      });
    } catch { /* best effort */ }

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur Gmail' },
      { status: 500 },
    );
  }
}
