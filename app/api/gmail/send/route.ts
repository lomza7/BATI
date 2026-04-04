import { NextResponse } from 'next/server';
import { authenticateGmailRequest, gmailFetch, getGmailConnection, buildRawEmail } from '@/lib/gmail';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await authenticateGmailRequest(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.to || !body?.subject || !body?.body) {
    return NextResponse.json({ error: 'to, subject et body requis' }, { status: 400 });
  }

  const conn = await getGmailConnection(auth.userId);
  if (!conn) {
    return NextResponse.json({ error: 'Gmail non connecte' }, { status: 400 });
  }

  try {
    const raw = buildRawEmail({
      from: conn.email_address || 'me',
      to: body.to,
      cc: body.cc || '',
      subject: body.subject,
      body: body.body,
      inReplyTo: body.inReplyTo || undefined,
      references: body.references || undefined,
    });

    const result = await gmailFetch<{ id: string; threadId: string }>(
      auth.userId,
      'https://www.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        body: JSON.stringify({ raw, threadId: body.threadId || undefined }),
      },
    );

    return NextResponse.json({ ok: true, messageId: result.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur envoi email' },
      { status: 500 },
    );
  }
}
