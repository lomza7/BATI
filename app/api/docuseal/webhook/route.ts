import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const eventType = body.event_type;
    if (eventType !== 'form.completed') {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const data = body.data;
    if (!data?.submission_id) {
      return NextResponse.json({ error: 'submission_id manquant' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Config serveur manquante' }, { status: 503 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Extraire les donnees DocuSeal
    const submissionId = data.submission_id as number;
    const submitterId = data.id as number | undefined;
    const auditLogUrl = (data.audit_log_url as string) || '';
    const documents = (data.documents as { name: string; url: string }[]) || [];
    const signedDocumentUrl = documents[0]?.url || '';
    const signerIp = (data.ip as string) || '';

    // Appeler la RPC sign_quote_docuseal
    const { data: rpcResult, error: rpcError } = await admin.rpc('sign_quote_docuseal', {
      p_docuseal_submission_id: submissionId,
      p_docuseal_submitter_id: submitterId || null,
      p_audit_log_url: auditLogUrl,
      p_signed_document_url: signedDocumentUrl,
      p_certificate_url: '', // DocuSeal inclut le certificat dans l'audit log
      p_signer_ip: signerIp,
    });

    if (rpcError) {
      console.error('sign_quote_docuseal error:', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: rpcResult });
  } catch (err) {
    console.error('DocuSeal webhook error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
