import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, updateGoogleReviewReply } from '@/lib/google-business';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getGoogleSession();
    if (!session) {
      return NextResponse.json({ error: 'Connexion Google introuvable' }, { status: 401 });
    }

    const { reviewName, comment } = (await request.json()) as { reviewName?: string; comment?: string };

    if (!reviewName || !comment?.trim()) {
      return NextResponse.json({ error: 'reviewName et comment sont requis' }, { status: 400 });
    }

    await updateGoogleReviewReply(reviewName, comment.trim(), session.accessToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Impossible de publier la reponse Google' },
      { status: 500 }
    );
  }
}
