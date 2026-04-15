'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Check,
  CreditCard,
  ExternalLink,
  Link2,
  Loader2,
  Shield,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle,
  Unplug,
  Euro,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface StripeStatus {
  connected: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  onboarding_completed?: boolean;
  details_submitted?: boolean;
  stripe_account_id?: string;
}

export function StripeConnectCard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [stripeError, setStripeError] = useState('');

  useEffect(() => {
    if (searchParams.get('stripe_connected') === '1') {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
    const err = searchParams.get('stripe_error');
    if (err) setStripeError(err);
  }, [searchParams]);

  useEffect(() => {
    if (user) loadStatus();
  }, [user]);

  async function loadStatus() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/stripe/connect/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setStripeStatus(data);
    } catch {
      setStripeStatus({ connected: false });
    }
    setLoading(false);
  }

  async function handleConnect() {
    setConnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.redirect_url) window.location.href = json.redirect_url;
      else setConnecting(false);
    } else {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Déconnecter votre compte Stripe ? Les liens de paiement existants ne fonctionneront plus.')) return;
    setDisconnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setDisconnecting(false);
      return;
    }
    await fetch('/api/stripe/connect/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setStripeStatus({ connected: false });
    setDisconnecting(false);
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <CreditCard className="h-5 w-5 text-primary" />
          Paiements en ligne (Stripe)
        </CardTitle>
        <CardDescription>
          Connectez Stripe pour recevoir les paiements de vos clients directement depuis vos factures — carte bancaire, Apple Pay, Google Pay.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 animate-fade-up">
            <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-800">Votre compte Stripe a été connecté avec succès !</p>
          </div>
        )}

        {stripeError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{stripeError}</p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-5">
            {loading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Chargement du statut Stripe...</p>
              </div>
            ) : !stripeStatus?.connected ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 flex-shrink-0">
                    <CreditCard className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Connecter Stripe</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vos clients pourront payer par carte bancaire, Apple Pay ou Google Pay sur les factures que vous leur envoyez.
                    </p>
                  </div>
                </div>
                <Button onClick={handleConnect} disabled={connecting} className="gap-2 shrink-0">
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  {connecting ? 'Redirection...' : 'Connecter Stripe'}
                </Button>
              </div>
            ) : !stripeStatus.onboarding_completed ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Onboarding Stripe incomplet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Votre compte Stripe est créé mais l&apos;inscription n&apos;est pas terminée. Complétez votre profil Stripe pour commencer à recevoir des paiements.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {stripeStatus.details_submitted && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" /> Profil soumis
                        </span>
                      )}
                      {stripeStatus.charges_enabled && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" /> Paiements actifs
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button onClick={handleConnect} disabled={connecting} className="gap-2 shrink-0">
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Reprendre l&apos;inscription
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Stripe connecté</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Votre compte Stripe est actif. Vos clients peuvent payer en ligne sur les factures envoyées.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check className="h-3 w-3" /> Paiements actifs
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check className="h-3 w-3" /> Virements actifs
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="gap-2 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                  Déconnecter
                </Button>
              </div>
            )}
          </div>
        </div>

        {!loading && !stripeStatus?.connected && (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">Paiements sécurisés</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Stripe est le leader mondial du paiement en ligne. Aucune donnée bancaire ne transite par Hellobat — tout est géré directement par Stripe.
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" /> Lien de paiement sur vos factures
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" /> Conforme PCI DSS
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Euro className="h-3.5 w-3.5" /> Virements automatiques
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
