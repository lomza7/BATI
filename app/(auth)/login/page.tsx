'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Eye, EyeOff, ArrowRight, ArrowLeft, Zap, RefreshCw, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Turnstile } from '@/components/shared/turnstile';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const teamInvite = searchParams.get('team') === '1';
  const invitedEmail = searchParams.get('email') || '';

  useEffect(() => {
    if (invitedEmail) {
      setEmail(invitedEmail);
    }
  }, [invitedEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (captchaToken === null) {
      setError('Vérification anti-bot en cours, réessayez dans un instant');
      return;
    }

    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect'
          : signInError.message
      );
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError('Connexion reussie, mais la session n a pas pu etre ouverte. Reessayez.');
      setLoading(false);
      return;
    }

    const { data: sessionState } = await supabase.auth.getSession();

    if (!sessionState.session) {
      setError('La session utilisateur n est pas encore disponible. Reessayez.');
      setLoading(false);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  }

  async function handleMagicLink() {
    if (!email.trim() || magicLinkSending) return;
    setError('');
    setMagicLinkSending(true);

    const { error: mlError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });

    setMagicLinkSending(false);

    if (mlError) {
      setError(mlError.message);
      return;
    }

    setMagicLinkSent(true);
    setTimeout(() => setMagicLinkSent(false), 8000);
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#1a1510]">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/2760243/pexels-photo-2760243.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
            alt="Construction"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1510] via-[#1a1510]/60 to-transparent" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Hellobat" width={40} height={40} />
            <span className="font-serif font-medium text-white text-xl">Hellobat</span>
          </div>
          <div className="space-y-6">
            <blockquote className="text-2xl font-serif italic text-white/90 leading-relaxed">
              &ldquo;Hellobat a transformé notre facon de gèrer nos chantiers.
              On gagne un temps fou sur la facturation.&rdquo;
            </blockquote>
            <div>
              <p className="text-white/80 font-medium">Marc Lefebvre</p>
              <p className="text-white/50 text-sm">Plombier chauffagiste a Lyon</p>
            </div>
          </div>
          <p className="text-white/30 text-xs">
            La plateforme tout-en-un pour les artisans du bâtiment
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[var(--landing-off)] relative">
        <Link
          href="/"
          className="absolute top-6 left-6 h-9 w-9 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Hellobat" width={36} height={36} />
            <span className="font-serif font-medium text-foreground text-lg">Hellobat</span>
          </div>

          <div className="space-y-2 mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Content de vous revoir
            </h1>
            <p className="text-muted-foreground">
              Connectez-vous pour accèder a votre espace
            </p>
          </div>

          {teamInvite && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Vous avez ete invite a rejoindre un espace equipe Hellobat. Connectez-vous avec cet email ou utilisez le magic link si vous avez deja un acces.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.fr"
                className="flex h-11 w-full rounded-lg border border-border bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Mot de passe
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Mot de passe oublie ?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
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

            <Turnstile onVerify={(token) => setCaptchaToken(token)} />

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Separateur */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground/60">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Magic link */}
          <button
            onClick={handleMagicLink}
            disabled={!email.trim() || magicLinkSending || magicLinkSent}
            className="w-full h-11 rounded-lg border border-border bg-white text-sm font-medium text-foreground flex items-center justify-center gap-2 hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {magicLinkSent ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                Lien envoye ! Verifiez votre boite mail
              </>
            ) : magicLinkSending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Recevoir un lien de connexion par email
              </>
            )}
          </button>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{' '}
            <Link
              href="/signup"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Créer un compte gratuitement
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
