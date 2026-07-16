import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createPublicDocumentPdf,
  getPublicDocumentFilename,
  type PublicDocumentPayload,
} from '@/lib/public-document-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token?.trim();
  if (!token || token.length < 20 || token.length > 200) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }

  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.rpc('get_public_quote_by_token', {
    p_token: token,
  });

  if (error || !data?.quote) {
    return NextResponse.json({ error: 'Devis introuvable ou lien expiré' }, { status: 404 });
  }

  const payload = data as PublicDocumentPayload;
  const bytes = await createPublicDocumentPdf(payload, 'quote');
  const filename = getPublicDocumentFilename(payload, 'quote');

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
