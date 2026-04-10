'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, Check, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase écoute le hash fragment (#access_token=...) et restaure la session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Vérifier si on a déjà une session recovery
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 2000);
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--landing-off)] px-6">
        <div className="w-full max-w-[440px] text-center">
          <div className="flex justify-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-primary animate-pulse" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Vérification en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--landing-off)] px-6">
      <div className="w-full max-w-[440px] text-center">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            {success ? (
              <Check className="h-7 w-7 text-emerald-600" />
            ) : (
              <Lock className="h-7 w-7 text-primary" />
            )}
          </div>
        </div>

        {success ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
              Mot de passe modifié
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Votre mot de passe a été mis à jour. Redirection vers votre espace...
            </p>
            <div className="h-1 w-32 mx-auto rounded-full bg-emerald-200 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-[progress_2s_ease-in-out]" style={{ width: '100%' }} />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
              Nouveau mot de passe
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Choisissez un nouveau mot de passe pour votre compte Hellobat.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-left mb-6">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="flex h-11 w-full rounded-lg border border-border bg-white px-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm" className="text-sm font-medium text-foreground">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Retapez le mot de passe"
                  className="flex h-11 w-full rounded-lg border border-border bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <Lock className="h-4 w-4 animate-pulse" />
                ) : (
                  'Mettre à jour le mot de passe'
                )}
              </button>
            </form>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
