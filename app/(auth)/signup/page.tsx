'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Eye, EyeOff, ArrowRight, Check, Gift, Sparkles, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Turnstile, type TurnstileHandle } from '@/components/shared/turnstile';

const benefits = [
  'Devis et factures en quelques clics',
  'Gestion de chantiers sur carte',
  'Planning équipe intégré',
  'Site web professionnel automatique',
];

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'valid'; code: string; description: string }
    | { state: 'invalid'; error: string }
  >({ state: 'idle' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const teamInvite = searchParams.get('team') === '1';
  const invitedEmail = searchParams.get('email') || '';
  const referralCode = searchParams.get('ref') || '';
  const promoParam = searchParams.get('promo') || '';

  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    if (invitedEmail) {
      setEmail(invitedEmail);
    }
  }, [invitedEmail]);

  useEffect(() => {
    if (referralCode) {
      try {
        localStorage.setItem('hellobat_referral_code', referralCode.toUpperCase());
      } catch {
        // ignore localStorage errors
      }
    }
  }, [referralCode]);

  // Code promo passé en query (?promo=...) → préremplit le champ.
  useEffect(() => {
    if (promoParam) {
      setPromoCode(promoParam.toUpperCase());
    }
  }, [promoParam]);

  // Validation live du code promo (debounced 450ms) contre Stripe.
  useEffect(() => {
    const trimmed = promoCode.trim().toUpperCase();
    if (!trimmed) {
      setPromoStatus({ state: 'idle' });
      return;
    }
    setPromoStatus({ state: 'checking' });
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/promo-codes/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: trimmed }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (data?.valid) {
          setPromoStatus({
            state: 'valid',
            code: data.code || trimmed,
            description: data.description || 'Code promo appliqué',
          });
        } else {
          setPromoStatus({
            state: 'invalid',
            error: data?.error || 'Code inconnu ou expiré',
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        // Erreur réseau — on ne bloque pas le signup, on passe en idle.
        setPromoStatus({ state: 'idle' });
        console.warn('[signup] promo validation failed', err);
      }
    }, 450);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [promoCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (captchaToken === null) {
      setError('Vérification anti-bot en cours, réessayez dans un instant');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (signUpError) {
      // Ne révèle pas si l'email existe déjà (anti-énumération).
      // Pour les vrais problèmes (mot de passe trop court côté Supabase, format email),
      // on garde le message brut puisqu'ils ne fuitent pas l'existence du compte.
      if (signUpError.message === 'User already registered') {
        // On simule une réussite : Supabase enverra automatiquement un email
        // de connexion à l'utilisateur existant si le flow le permet, sinon
        // l'utilisateur arrivera sur l'écran "vérifiez vos mails".
        localStorage.setItem('hellobat_signup_email', email);
        router.push('/verify-email');
        return;
      }
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    localStorage.setItem('hellobat_signup_email', email);
    // Mémorise le code promo pour l'appliquer automatiquement à la
    // 1ère souscription Stripe (fin du trial 30j).
    const normalizedPromo = promoCode.trim().toUpperCase();
    if (normalizedPromo) {
      try {
        localStorage.setItem('hellobat_promo_code', normalizedPromo);
      } catch {
        // ignore
      }
    }
    router.push('/verify-email');
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#1a1510]">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/585419/pexels-photo-585419.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
            alt="Artisan au travail"
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
          <div className="space-y-8">
            <h2 className="text-3xl font-semibold text-white leading-tight">
              Tout ce dont vous avez<br />
              besoin pour gérer<br />
              votre activité.
            </h2>
            <ul className="space-y-4">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3.5 w-3.5 text-white/80" />
                  </div>
                  <span className="text-white/70 text-sm">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-white/30 text-xs">
            Essai gratuit - Aucune carte bancaire requise
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[var(--landing-off)]">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Hellobat" width={36} height={36} />
            <span className="font-serif font-medium text-foreground text-lg">Hellobat</span>
          </div>

          <div className="space-y-2 mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Créez votre compte
            </h1>
            <p className="text-muted-foreground">
              Commencez à gérer vos chantiers en quelques minutes
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <Gift className="h-4.5 w-4.5 text-emerald-700" />
            </div>
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">30 jours gratuits, sans engagement</p>
              <p className="text-xs text-emerald-800/80 mt-0.5">
                Toutes les fonctionnalités Pro débloquées pendant 30 jours. Aucune carte bancaire
                demandée.
              </p>
            </div>
          </div>

          {teamInvite && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Vous avez été invité à rejoindre un espace équipe Hellobat. Créez votre accès avec cet email et nous activerons automatiquement votre place dans l&apos;équipe.
            </div>
          )}

          {referralCode && !teamInvite && (
            <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex items-start gap-3">
              <Gift className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-foreground">
                <p className="font-semibold">2 mois offerts</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vous bénéficiez de 2 mois gratuits grâce au parrainage <span className="font-mono font-semibold text-foreground">{referralCode.toUpperCase()}</span>.
                </p>
              </div>
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
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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
              {password.length > 0 && (
                <div className="flex gap-1.5 pt-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        level <= passwordStrength.level
                          ? passwordStrength.color
                          : 'bg-border'
                      }`}
                    />
                  ))}
                  <span className={`text-xs ml-2 ${passwordStrength.textColor}`}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Code promo (optionnel) — toujours visible, pré-rempli si ?promo=... */}
            <div className="space-y-2">
              <label htmlFor="promo" className="text-sm font-medium text-foreground">
                Code promo <span className="text-muted-foreground font-normal">(optionnel)</span>
              </label>
              <div className="relative">
                <input
                  id="promo"
                  type="text"
                  autoComplete="off"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Entrez votre code promo"
                  className={`flex h-11 w-full rounded-lg border bg-white px-4 pr-10 text-sm font-mono text-foreground placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-all uppercase tracking-wide ${
                    promoStatus.state === 'valid'
                      ? 'border-emerald-300 focus:ring-emerald-200 focus:border-emerald-500'
                      : promoStatus.state === 'invalid'
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                        : 'border-border focus:ring-primary/20 focus:border-primary'
                  }`}
                />
                {promoStatus.state === 'checking' && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {promoStatus.state === 'valid' && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                )}
                {promoStatus.state === 'invalid' && (
                  <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                )}
              </div>

              {promoStatus.state === 'valid' && (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <Sparkles className="h-4 w-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm leading-tight">
                    <p className="font-semibold text-emerald-900">
                      {promoStatus.description}
                    </p>
                    <p className="text-xs text-emerald-800/80 mt-0.5">
                      Appliqué automatiquement à votre souscription, après les 30 jours d&apos;essai.
                    </p>
                  </div>
                </div>
              )}

              {promoStatus.state === 'invalid' && (
                <p className="text-xs text-red-600">{promoStatus.error}</p>
              )}
            </div>

            <Turnstile ref={turnstileRef} onVerify={(token) => setCaptchaToken(token)} />

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Créer mon compte
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-3 text-xs text-center text-muted-foreground/70">
            En créant un compte, vous acceptez nos conditions d&apos;utilisation
          </p>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Déjà un compte ?{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string) {
  if (password.length === 0) return { level: 0, label: '', color: '', textColor: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;

  const strengths = [
    { level: 1, label: 'Faible', color: 'bg-red-400', textColor: 'text-red-500' },
    { level: 2, label: 'Moyen', color: 'bg-amber-400', textColor: 'text-amber-600' },
    { level: 3, label: 'Bon', color: 'bg-emerald-400', textColor: 'text-emerald-600' },
    { level: 4, label: 'Fort', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
  ];

  return strengths[Math.min(score, 4) - 1] || strengths[0];
}
