import { NextResponse } from 'next/server';
import { authenticateGmailRequest, gmailFetch, parseMessageToHeader } from '@/lib/gmail';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await authenticateGmailRequest(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const folder = url.searchParams.get('folder') || 'inbox';
  const query = url.searchParams.get('q') || '';
  const pageToken = url.searchParams.get('pageToken') || '';

  // Build Gmail query
  let q = '';
  if (folder === 'inbox') q = 'in:inbox';
  else if (folder === 'sent') q = 'in:sent';
  else if (folder === 'starred') q = 'is:starred';
  else if (folder === 'drafts') q = 'in:drafts';

  if (query) q += ` ${query}`;

  const params = new URLSearchParams({
    q: q.trim(),
    maxResults: '20',
    ...(pageToken ? { pageToken } : {}),
  });

  try {
    const list = await gmailFetch<{
      messages?: { id: string; threadId: string }[];
      nextPageToken?: string;
      resultSizeEstimate?: number;
    }>(auth.userId, `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`);

    if (!list.messages?.length) {
      return NextResponse.json({ messages: [], nextPageToken: null });
    }

    // Fetch metadata for each message (batch via individual calls — Gmail batch API requires multipart)
    const messages = await Promise.all(
      list.messages.slice(0, 20).map(async (m) => {
        const full = await gmailFetch<{
          id: string; threadId: string; snippet: string; labelIds?: string[];
          payload?: { headers: { name: string; value: string }[] };
        }>(auth.userId, `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`);
        return parseMessageToHeader(full);
      })
    );

    return NextResponse.json({
      messages,
      nextPageToken: list.nextPageToken || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur Gmail' },
      { status: 500 },
    );
  }
}
