'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Hexagon, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const benefits = [
  'Devis et factures en quelques clics',
  'Gestion de chantiers sur carte',
  'Planning equipe integre',
  'Site web professionnel automatique',
];

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const teamInvite = searchParams.get('team') === '1';
  const invitedEmail = searchParams.get('email') || '';

  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    if (invitedEmail) {
      setEmail(invitedEmail);
    }
  }, [invitedEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(
        signUpError.message === 'User already registered'
          ? 'Un compte existe deja avec cet email'
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    localStorage.setItem('hellobat_signup_email', email);
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
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-white">Hellobat</span>
          </div>
          <div className="space-y-8">
            <h2 className="text-3xl font-semibold text-white leading-tight">
              Tout ce dont vous avez<br />
              besoin pour gerer<br />
              votre activite.
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
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Hexagon className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">Hellobat</span>
          </div>

          <div className="space-y-2 mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Créez votre compte
            </h1>
            <p className="text-muted-foreground">
              Commencez a gérer vos chantiers en quelques minutes
            </p>
          </div>

          {teamInvite && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Vous avez ete invite a rejoindre un espace equipe Hellobat. Creez votre acces avec cet email et nous activerons automatiquement votre place dans l equipe.
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
                  placeholder="Minimum 6 caracteres"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Hexagon className="h-4 w-4 animate-nut-ratchet" />
              ) : (
                <>
                  Creer mon compte
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-3 text-xs text-center text-muted-foreground/70">
            En creant un compte, vous acceptez nos conditions d&apos;utilisation
          </p>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Deja un compte ?{' '}
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
