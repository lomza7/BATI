'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, RefreshCw, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, session, signOut } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const autoSentRef = useRef(false);

  const sendCode = useCallback(async (opts: { manual?: boolean } = {}) => {
    if (!session?.access_token) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!opts.manual && res.status === 429) {
          // Silent on auto-send when throttled
        } else {
          setError(data.error || 'Impossible d envoyer le code.');
        }
        return;
      }
      if (data.already_verified) {
        router.push('/dashboard');
        return;
      }
      if (opts.manual) {
        setSent(true);
        setTimeout(() => setSent(false), 4000);
      }
      setCooldown(30);
    } catch {
      setError('Erreur reseau. Reessayez.');
    } finally {
      setSending(false);
    }
  }, [session?.access_token, router]);

  // Redirect if not signed in
  useEffect(() => {
    if (!session && !user) {
      const timer = setTimeout(() => router.push('/login'), 50);
      return () => clearTimeout(timer);
    }
  }, [session, user, router]);

  // Auto-send the first code when the page loads with a valid session
  useEffect(() => {
    if (!session?.access_token) return;
    if (autoSentRef.current) return;
    autoSentRef.current = true;
    void sendCode();
  }, [session?.access_token, sendCode]);

  // Countdown for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (digits.every((d) => d.length === 1) && !submitting) {
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  function handleChange(index: number, value: string) {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    // Handle paste of multiple digits
    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < clean.length && index + i < CODE_LENGTH; i += 1) {
        next[index + i] = clean[i];
      }
      setDigits(next);
      const lastFilled = Math.min(index + clean.length, CODE_LENGTH - 1);
      inputsRef.current[lastFilled]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
    }
    if (e.key === 'ArrowLeft' && index > 0) inputsRef.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  }

  async function handleSubmit() {
    if (!session?.access_token) return;
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-email-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Code incorrect.');
        setDigits(Array(CODE_LENGTH).fill(''));
        inputsRef.current[0]?.focus();
        return;
      }
      // Refresh session so any cached profile reflects email_verified = true
      await supabase.auth.refreshSession();
      // Hard navigation so auth-context re-fetches the profile fresh
      // and the app layout guard sees email_verified = true.
      window.location.href = '/dashboard';
    } catch {
      setError('Erreur reseau. Reessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeEmail() {
    await signOut();
    router.push('/signup');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--landing-off)] px-6">
      <div className="w-full max-w-[440px] text-center">
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="h-7 w-7 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
          Verifiez votre email
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-1">
          Nous avons envoye un code a 6 chiffres a
        </p>
        {user?.email && (
          <p className="text-foreground font-medium mb-7">{user.email}</p>
        )}

        <div className="flex justify-center gap-2 mb-4" onPaste={(e) => {
          const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
          if (pasted) {
            e.preventDefault();
            const next = Array(CODE_LENGTH).fill('');
            for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i];
            setDigits(next);
            inputsRef.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
          }
        }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={submitting}
              className="h-14 w-12 rounded-lg border border-border bg-white text-center text-2xl font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-60"
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}

        {submitting && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Verification...
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-5">
          Le code expire dans 10 minutes. Pensez a verifier vos spams.
        </p>

        <button
          onClick={() => sendCode({ manual: true })}
          disabled={sending || cooldown > 0}
          className="w-full h-11 rounded-lg border border-border bg-white text-sm font-medium text-foreground flex items-center justify-center gap-2 hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-3"
        >
          {sent ? (
            <>
              <Check className="h-4 w-4 text-emerald-500" />
              Code renvoye !
            </>
          ) : sending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Envoi...
            </>
          ) : cooldown > 0 ? (
            <>Renvoyer le code ({cooldown}s)</>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Renvoyer le code
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleChangeEmail}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Utiliser un autre email
        </button>

        <div className="mt-8 pt-6 border-t border-border">
          <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Deja verifie ? Connectez-vous
          </Link>
        </div>
      </div>
    </div>
  );
}
