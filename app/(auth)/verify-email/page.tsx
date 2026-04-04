'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Hexagon, Mail, RefreshCw, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    // Recuperer l'email depuis la session ou le localStorage
    const stored = localStorage.getItem('hellobat_signup_email');
    if (stored) setEmail(stored);

    // Verifier si l'utilisateur est deja confirme
    const checkConfirmed = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email_confirmed_at) {
        localStorage.removeItem('hellobat_signup_email');
        router.push('/dashboard');
      }
    };

    checkConfirmed();

    // Ecouter les changements d'auth (quand l'utilisateur clique sur le lien)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        localStorage.removeItem('hellobat_signup_email');
        router.push('/dashboard');
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);

    await supabase.auth.resend({
      type: 'signup',
      email,
    });

    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--landing-off)] px-6">
      <div className="w-full max-w-[440px] text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="h-7 w-7 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
          Verifiez votre email
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-2">
          Nous avons envoye un lien de confirmation a
        </p>
        {email && (
          <p className="text-foreground font-medium mb-6">{email}</p>
        )}

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
            <p className="text-sm text-foreground">Cliquez sur le lien de confirmation</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <p className="text-sm text-foreground">Vous serez redirige automatiquement</p>
          </div>
        </div>

        <button
          onClick={handleResend}
          disabled={resending || resent}
          className="w-full h-11 rounded-lg border border-border bg-white text-sm font-medium text-foreground flex items-center justify-center gap-2 hover:bg-muted/50 disabled:opacity-50 transition-all mb-3"
        >
          {resent ? (
            <>
              <Check className="h-4 w-4 text-emerald-500" />
              Email renvoye !
            </>
          ) : resending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Renvoyer l&apos;email
            </>
          )}
        </button>

        <p className="text-xs text-muted-foreground mb-6">
          Pensez a verifier vos spams si vous ne recevez rien
        </p>

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
