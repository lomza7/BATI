import { NextResponse } from 'next/server';
import { authenticateGmailRequest, gmailFetch } from '@/lib/gmail';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await authenticateGmailRequest(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.messageId || !body?.action) {
    return NextResponse.json({ error: 'messageId et action requis' }, { status: 400 });
  }

  const { messageId, action } = body as {
    messageId: string;
    action: 'star' | 'unstar' | 'archive' | 'unarchive' | 'read' | 'unread' | 'trash';
  };

  const modifications: { addLabelIds?: string[]; removeLabelIds?: string[] } = {};

  switch (action) {
    case 'star':
      modifications.addLabelIds = ['STARRED'];
      break;
    case 'unstar':
      modifications.removeLabelIds = ['STARRED'];
      break;
    case 'archive':
      modifications.removeLabelIds = ['INBOX'];
      break;
    case 'unarchive':
      modifications.addLabelIds = ['INBOX'];
      break;
    case 'read':
      modifications.removeLabelIds = ['UNREAD'];
      break;
    case 'unread':
      modifications.addLabelIds = ['UNREAD'];
      break;
    case 'trash':
      try {
        await gmailFetch(auth.userId, `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
          method: 'POST',
        });
        return NextResponse.json({ ok: true });
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur' }, { status: 500 });
      }
  }

  try {
    await gmailFetch(auth.userId, `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify(modifications),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur modification' },
      { status: 500 },
    );
  }
}
