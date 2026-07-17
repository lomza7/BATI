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
  const { data, error } = await anon.rpc('get_public_invoice_by_token', {
    p_token: token,
  });

  if (error || !data?.invoice) {
    return NextResponse.json({ error: 'Facture introuvable ou lien expiré' }, { status: 404 });
  }

  const payload = data as PublicDocumentPayload;
  const bytes = await createPublicDocumentPdf(payload, 'invoice');
  const filename = getPublicDocumentFilename(payload, 'invoice');
  const body = Buffer.from(bytes);

  return new NextResponse(body, {
    status: 200,
    headers: {
      // octet-stream empêche les navigateurs mobiles d'ouvrir leur lecteur PDF
      // et privilégie l'enregistrement immédiat dans les téléchargements.
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
