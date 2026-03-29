'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Hexagon, Eye, EyeOff, ArrowRight, ArrowLeft, Loader as Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
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

    router.push('/dashboard');
    router.refresh();
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
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-white">BatiFlow</span>
          </div>
          <div className="space-y-6">
            <blockquote className="text-2xl font-serif italic text-white/90 leading-relaxed">
              &ldquo;BatiFlow a transforme notre facon de gerer nos chantiers.
              On gagne un temps fou sur la facturation.&rdquo;
            </blockquote>
            <div>
              <p className="text-white/80 font-medium">Marc Lefebvre</p>
              <p className="text-white/50 text-sm">Plombier chauffagiste a Lyon</p>
            </div>
          </div>
          <p className="text-white/30 text-xs">
            La plateforme tout-en-un pour les artisans du batiment
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
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Hexagon className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">BatiFlow</span>
          </div>

          <div className="space-y-2 mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Content de vous revoir
            </h1>
            <p className="text-muted-foreground">
              Connectez-vous pour acceder a votre espace
            </p>
          </div>

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

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{' '}
            <Link
              href="/signup"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Creer un compte gratuitement
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
