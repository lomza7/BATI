import { NextResponse } from 'next/server';
import { createHash, randomInt } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildVerificationCodeEmail } from '@/lib/email-templates';

export const runtime = 'nodejs';

const EXPIRES_IN_MINUTES = 10;
const MIN_RESEND_INTERVAL_MS = 30_000; // 30s throttling

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  // 6-digit numeric code, zero-padded
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Session utilisateur requise' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 503 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user || !user.email) {
    return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
  }

  // If the profile is already verified, no-op
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email_verified')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.email_verified) {
    return NextResponse.json({ ok: true, already_verified: true });
  }

  // Throttle: reject if we sent a code less than 30s ago
  const { data: lastRow } = await supabaseAdmin
    .from('email_verifications')
    .select('created_at')
    .eq('user_id', user.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRow) {
    const elapsed = Date.now() - new Date(lastRow.created_at).getTime();
    if (elapsed < MIN_RESEND_INTERVAL_MS) {
      const retryIn = Math.ceil((MIN_RESEND_INTERVAL_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Veuillez patienter ${retryIn}s avant de redemander un code.` },
        { status: 429 }
      );
    }
  }

  // Invalidate any previous unconsumed codes
  await supabaseAdmin
    .from('email_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('consumed_at', null);

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + EXPIRES_IN_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from('email_verifications')
    .insert({
      user_id: user.id,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('RESEND_API_KEY missing — cannot send verification email');
    return NextResponse.json({ error: 'Service email indisponible' }, { status: 503 });
  }

  const resend = new Resend(resendKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hellobat <equipe@hellobat.app>';

  try {
    await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: `Votre code Hellobat : ${code}`,
      html: buildVerificationCodeEmail({ code, expiresInMinutes: EXPIRES_IN_MINUTES }),
    });
  } catch (e) {
    console.error('Verification email send error:', e);
    return NextResponse.json({ error: 'Impossible d envoyer l email' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, expires_in_minutes: EXPIRES_IN_MINUTES });
}
