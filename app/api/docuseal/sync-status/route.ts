import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { docusealFetch } from '@/lib/docuseal';

export const runtime = 'nodejs';

// Verifie l'etat d'une submission DocuSeal et met a jour la base si signee
// Appele cote client apres onComplete comme fallback au webhook
export async function POST(request: Request) {
  try {
    const { submission_id } = await request.json();
    if (!submission_id) {
      return NextResponse.json({ error: 'submission_id requis' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Config serveur manquante' }, { status: 503 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verifier que ce submission_id existe en base
    const { data: send, error: queryError } = await admin
      .from('quote_sends')
      .select('id, signed_at, docuseal_submission_id')
      .eq('docuseal_submission_id', submission_id)
      .maybeSingle();

    if (!send) {
      return NextResponse.json({ error: 'Submission introuvable' }, { status: 404 });
    }

    // Deja signe en base — rien a faire
    if (send.signed_at) {
      return NextResponse.json({ ok: true, already_signed: true });
    }

    // Interroger DocuSeal pour l'etat de la submission
    interface DocuSealSubmission {
      id: number;
      status: string;
      audit_log_url?: string;
      submitters: {
        id: number;
        status: string;
        ip?: string;
        documents?: { name: string; url: string }[];
      }[];
    }

    const submission = await docusealFetch<DocuSealSubmission>(`/submissions/${submission_id}`);

    if (!submission || submission.status !== 'completed') {
      return NextResponse.json({ ok: true, status: submission?.status || 'unknown' });
    }

    // La submission est completee — extraire les donnees
    const submitter = submission.submitters?.[0];
    const signedDocumentUrl = submitter?.documents?.[0]?.url || '';
    const auditLogUrl = submission.audit_log_url || '';
    const signerIp = submitter?.ip || '';

    // Appeler la RPC pour mettre a jour
    const { error: rpcError } = await admin.rpc('sign_quote_docuseal', {
      p_docuseal_submission_id: submission_id,
      p_docuseal_submitter_id: submitter?.id || null,
      p_audit_log_url: auditLogUrl,
      p_signed_document_url: signedDocumentUrl,
      p_certificate_url: '',
      p_signer_ip: signerIp,
    });

    if (rpcError) {
      console.error('sync sign_quote_docuseal error:', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, synced: true });
  } catch (err) {
    console.error('DocuSeal sync error:', err);
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
