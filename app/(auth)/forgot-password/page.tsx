'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setError('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--landing-off)] px-6">
      <div className="w-full max-w-[440px] text-center">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="h-7 w-7 text-primary" />
          </div>
        </div>

        {sent ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
              Email envoye
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-2">
              Un lien de reinitialisation a ete envoye a
            </p>
            <p className="text-foreground font-medium mb-6">{email}</p>

            <div className="rounded-xl border border-border bg-white p-5 mb-6 text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <p className="text-sm text-foreground">Ouvrez votre boite email</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <p className="text-sm text-foreground">Cliquez sur le lien de reinitialisation</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <p className="text-sm text-foreground">Choisissez votre nouveau mot de passe</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-6">
              Pensez a verifier vos spams si vous ne recevez rien
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
              Mot de passe oublie ?
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Entrez votre adresse email et nous vous enverrons un lien pour reinitialiser votre mot de passe.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-left animate-in fade-in slide-in-from-top-1 duration-200">
                  {error}
                </div>
              )}

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.fr"
                className="flex h-11 w-full rounded-lg border border-border bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Envoyer le lien'
                )}
              </button>
            </form>
          </>
        )}

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour a la connexion
        </Link>
      </div>
    </div>
  );
}
