'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Euro,
  Link2,
  Check,
  Shield,
  ExternalLink,
  Unplug,
  Eye,
  Clock,
  CircleCheck as CheckCircle,
  TriangleAlert as AlertTriangle,
  Loader as Loader2,
  Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, INVOICE_STATUSES } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

interface StripeStatus {
  connected: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  onboarding_completed?: boolean;
  details_submitted?: boolean;
  stripe_account_id?: string;
}

interface InvoiceSend {
  id: string;
  invoice_id: string;
  client_name: string;
  client_email: string;
  token: string;
  expires_at: string;
  viewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  invoices: {
    invoice_number: string;
    title: string;
    total_ttc: number;
    status: keyof typeof INVOICE_STATUSES;
    payment_method: string;
  } | null;
}

export default function PaiementsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [sends, setSends] = useState<InvoiceSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [stripeError, setStripeError] = useState('');

  useEffect(() => {
    if (searchParams.get('stripe_connected') === '1') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
    const err = searchParams.get('stripe_error');
    if (err) {
      setStripeError(err);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch Stripe Connect status
    try {
      const res = await fetch('/api/stripe/connect/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setStripeStatus(data);
    } catch {
      setStripeStatus({ connected: false });
    }

    // Fetch invoice sends
    const { data: sendsData } = await supabase
      .from('invoice_sends')
      .select('id, invoice_id, client_name, client_email, token, expires_at, viewed_at, paid_at, created_at, invoices(invoice_number, title, total_ttc, status, payment_method)')
      .order('created_at', { ascending: false });

    setSends((sendsData as unknown as InvoiceSend[]) || []);
    setLoading(false);
  }

  async function handleConnect() {
    setConnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.href = `/api/stripe/connect?token=${session.access_token}`;
    }
  }

  async function handleDisconnect() {
    if (!confirm('Déconnecter votre compte Stripe ? Les liens de paiement existants ne fonctionneront plus.')) return;
    setDisconnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch('/api/stripe/connect/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    setStripeStatus({ connected: false });
    setDisconnecting(false);
  }

  const totalPaid = sends.filter(s => s.paid_at).reduce((sum, s) => sum + (s.invoices?.total_ttc || 0), 0);
  const totalPending = sends.filter(s => !s.paid_at && new Date(s.expires_at) > new Date()).reduce((sum, s) => sum + (s.invoices?.total_ttc || 0), 0);
  const paidCount = sends.filter(s => s.paid_at).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Paiements Stripe" description="Recevez les paiements de vos clients en ligne" />

      {/* Success banner */}
      {showSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 animate-fade-up">
          <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-800">Votre compte Stripe a ete connecte avec succes !</p>
        </div>
      )}

      {/* Error banner */}
      {stripeError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{stripeError}</p>
        </div>
      )}

      {/* Stripe Connect Status Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Chargement du statut Stripe...</p>
            </div>
          ) : !stripeStatus?.connected ? (
            /* Not connected */
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 flex-shrink-0">
                  <CreditCard className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Connecter Stripe</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connectez votre compte Stripe pour recevoir les paiements de vos clients directement sur vos factures.
                    Vos clients pourront payer par carte bancaire, Apple Pay ou Google Pay.
                  </p>
                </div>
              </div>
              <Button onClick={handleConnect} disabled={connecting} className="gap-2 shrink-0">
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                {connecting ? 'Redirection...' : 'Connecter Stripe'}
              </Button>
            </div>
          ) : !stripeStatus.onboarding_completed ? (
            /* Onboarding incomplete */
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Onboarding Stripe incomplet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Votre compte Stripe est créé mais l&apos;inscription n&apos;est pas terminée.
                    Completez votre profil Stripe pour commencer a recevoir des paiements.
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
            /* Connected */
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Stripe connecte</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Votre compte Stripe est actif. Vos clients peuvent payer en ligne sur vos factures envoyees.
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
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="gap-2 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                Déconnecter
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      {stripeStatus?.connected && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Euro className="h-4 w-4 text-emerald-500" /> Encaisse en ligne
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-blue-500" /> En attente de paiement
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totalPending)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4 text-primary" /> Paiements recus
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{paidCount}</p>
          </div>
        </div>
      )}

      {/* Invoice sends list */}
      {stripeStatus?.connected && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Factures envoyees</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Suivez les factures envoyees et leur statut de paiement</p>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
            </div>
          ) : sends.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Send}
                title="Aucune facture envoyee"
                description="Envoyez une facture a un client depuis la page Factures pour la retrouver ici."
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sends.map(send => {
                const isPaid = !!send.paid_at;
                const isExpired = !isPaid && new Date(send.expires_at) < new Date();
                const isViewed = !!send.viewed_at;
                const inv = send.invoices;
                const st = inv ? INVOICE_STATUSES[inv.status] || INVOICE_STATUSES.brouillon : null;

                return (
                  <div key={send.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isPaid ? 'bg-emerald-50' : isExpired ? 'bg-slate-100' : 'bg-blue-50'}`}>
                        {isPaid ? (
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        ) : isExpired ? (
                          <Clock className="h-5 w-5 text-slate-400" />
                        ) : (
                          <Send className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {inv?.title || 'Facture'} — {send.client_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{inv?.invoice_number}</span>
                          {send.client_email && <span className="text-xs text-muted-foreground">{send.client_email}</span>}
                          {isViewed && !isPaid && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                              <Eye className="h-3 w-3" /> Vue
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end">
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(inv?.total_ttc || 0)}</span>
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <Check className="h-3 w-3" /> Payee
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                          Expire
                        </span>
                      ) : st ? (
                        <StatusBadge label={st.label} color={st.color} />
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          En attente
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(send.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Info card when not connected */}
      {!loading && !stripeStatus?.connected && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Paiements securises</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Stripe est le leader mondial du paiement en ligne. Vos clients peuvent payer par carte bancaire, Apple Pay ou Google Pay.
                Aucune donnee bancaire ne transite par Hellobat — tout est gere directement par Stripe.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" /> Lien de paiement sur vos factures
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" /> Conforme PCI DSS
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Euro className="h-3.5 w-3.5" /> Virements automatiques sur votre compte
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
