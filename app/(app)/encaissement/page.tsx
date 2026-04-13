'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  CreditCard,
  Loader2,
  Check,
  X,
  Receipt,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, INVOICE_STATUSES } from '@/lib/constants';
import { LINE_TVA_RATES, computeTvaBreakdown, formatTvaRate } from '@/lib/tva';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ClientPicker } from '@/components/shared/client-picker';
import { BankAccountPicker } from '@/components/shared/bank-account-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Step = 'form' | 'payment' | 'processing' | 'success' | 'error';

interface RecentPayment {
  id: string;
  invoice_number: string;
  title: string;
  total_ttc: number;
  status: keyof typeof INVOICE_STATUSES;
  paid_at: string | null;
  created_at: string;
  clients: { name: string } | null;
}

// ---------- Payment form (inside Elements provider) ----------

function PaymentForm({
  totalTtc,
  onSuccess,
  onError,
  onCancel,
}: {
  totalTtc: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      setProcessing(false);
      onError(error.message || 'Le paiement a echoue');
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Montant a encaisser</span>
        <span className="text-xl font-bold">{formatCurrency(totalTtc)}</span>
      </div>

      <div className="rounded-lg border border-border p-4">
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            layout: 'tabs',
            wallets: { applePay: 'auto', googlePay: 'auto' },
          }}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={processing}>
          Retour
        </Button>
        <Button type="submit" className="flex-1" size="lg" disabled={!stripe || !ready || processing}>
          {processing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Traitement...</>
          ) : (
            <><CreditCard className="mr-2 h-4 w-4" /> Encaisser {formatCurrency(totalTtc)}</>
          )}
        </Button>
      </div>
    </form>
  );
}

// ---------- Main page ----------

export default function EncaissementPage() {
  const { user, session } = useAuth();

  // Stripe status
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [title, setTitle] = useState('');
  const [totalHt, setTotalHt] = useState<number>(0);
  const [tvaRate, setTvaRate] = useState(20);
  const [clientId, setClientId] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);

  // Payment
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState('');

  // Recent payments
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);

  // Computed amounts
  const tvaAmount = (totalHt || 0) * tvaRate / 100;
  const totalTtc = (totalHt || 0) + tvaAmount;

  useEffect(() => {
    checkStripeStatus();
    loadRecentPayments();
  }, [user, session?.access_token]);

  async function checkStripeStatus() {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/stripe/connect/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setStripeConnected(data.charges_enabled === true);
    } catch {
      setStripeConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentPayments() {
    if (!user) return;
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, title, total_ttc, status, paid_at, created_at, clients(name)')
      .in('payment_method', ['terminal', 'hellopay'])
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentPayments((data as unknown as RecentPayment[]) || []);
  }

  async function startPayment() {
    if (!session?.access_token || !user || totalTtc <= 0) return;

    setStep('processing');
    setError('');

    try {
      // 1. Create invoice
      const tva = computeTvaBreakdown([
        { quantity: 1, unit_price: totalHt, tva_rate: tvaRate },
      ]);

      const { getNextInvoiceNumber } = await import('@/lib/document-numbers');
      const invoiceNumber = await getNextInvoiceNumber(supabase, user.id);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { data: invoice } = await supabase.from('invoices').insert({
        user_id: user.id,
        invoice_number: invoiceNumber,
        client_id: clientId,
        bank_account_id: bankAccountId,
        title: title || 'HelloPay',
        total_ht: tva.total_ht,
        total_tva: tva.total_tva,
        total_ttc: tva.total_ttc,
        tva_rate: tva.primary_rate,
        tva_breakdown: tva.tva_breakdown,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'creee',
        issued_at: new Date().toISOString(),
        payment_method: 'hellopay',
      }).select('id').single();

      if (!invoice) throw new Error('Erreur creation facture');

      // Create invoice line
      if (totalHt > 0) {
        await supabase.from('invoice_lines').insert({
          user_id: user.id,
          invoice_id: invoice.id,
          description: title || 'HelloPay',
          quantity: 1,
          unit: 'forfait',
          unit_price: totalHt,
          tva_rate: tvaRate,
          total: totalHt,
          position: 0,
        });
      }

      setCreatedInvoiceNumber(invoiceNumber);

      // 2. Create PaymentIntent via API
      const amountCents = Math.round(tva.total_ttc * 100);
      const res = await fetch('/api/stripe/connect/hellopay', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount_cents: amountCents,
          description: `${invoiceNumber} — ${title || 'HelloPay'}`,
          invoice_id: invoice.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur creation paiement');

      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) throw new Error('Configuration Stripe manquante');

      setClientSecret(data.client_secret);
      setStripePromise(loadStripe(publishableKey, { stripeAccount: data.stripe_account_id }));
      setStep('payment');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur paiement');
      setStep('error');
    }
  }

  function handlePaymentSuccess() {
    setStep('success');
    loadRecentPayments();
  }

  function handlePaymentError(msg: string) {
    setError(msg);
    setStep('error');
  }

  function resetForm() {
    setTitle('');
    setTotalHt(0);
    setTvaRate(20);
    setClientId(null);
    setBankAccountId(null);
    setStep('form');
    setError('');
    setClientSecret('');
    setStripePromise(null);
    setCreatedInvoiceNumber('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stripeConnected === false) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <PageHeader title="HelloPay" description="Encaissez vos clients directement depuis votre telephone" />
        <div className="mt-8">
          <EmptyState
            icon={CreditCard}
            title="Stripe non connecte"
            description="Connectez votre compte Stripe dans la section Paiements pour activer HelloPay."
          >
            <Button onClick={() => window.location.href = '/paiements'}>
              Configurer Stripe
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <PageHeader title="HelloPay" description="Encaissez vos clients directement depuis votre telephone" />

      {/* STEP: FORM */}
      {step === 'form' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-base font-semibold">Nouveau paiement</h2>

            <div>
              <label className="text-sm font-medium">Objet</label>
              <Input
                className="mt-1"
                placeholder="Ex: Travaux salle de bain"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Client</label>
              <ClientPicker
                className="mt-1"
                value={clientId}
                onChange={(id) => setClientId(id)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Montant HT</label>
                <Input
                  className="mt-1"
                  type="number"
                  placeholder="0"
                  value={totalHt || ''}
                  onChange={e => setTotalHt(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Taux de TVA</label>
                <Select value={String(tvaRate)} onValueChange={v => setTvaRate(Number(v))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_TVA_RATES.map(r => (
                      <SelectItem key={r} value={String(r)}>TVA {formatTvaRate(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <BankAccountPicker value={bankAccountId} onChange={setBankAccountId} />

            {/* Total preview */}
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm flex items-center justify-between">
              <div className="text-muted-foreground">
                <p>Total HT : <span className="font-medium text-foreground">{formatCurrency(totalHt || 0)}</span></p>
                <p className="text-xs mt-0.5">TVA {formatTvaRate(tvaRate)} : {formatCurrency(tvaAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">TTC</p>
                <p className="text-lg font-semibold">{formatCurrency(totalTtc)}</p>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={startPayment}
              disabled={totalHt <= 0}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Encaisser {totalTtc > 0 ? formatCurrency(totalTtc) : ''}
            </Button>
          </div>

          {/* Recent payments */}
          {recentPayments.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Derniers encaissements</h2>
              <div className="space-y-2">
                {recentPayments.map(p => {
                  const st = INVOICE_STATUSES[p.status] || INVOICE_STATUSES.brouillon;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.clients?.name || 'Client inconnu'} — {p.invoice_number}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold">{formatCurrency(p.total_ttc)}</p>
                        <p className={`text-xs ${p.status === 'payee' ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {st.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP: PROCESSING (creating invoice + payment intent) */}
      {step === 'processing' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Preparation du paiement...</p>
          </div>
        </div>
      )}

      {/* STEP: PAYMENT — Stripe Payment Element */}
      {step === 'payment' && clientSecret && stripePromise && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold mb-4">Paiement par carte</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Donnez votre telephone au client pour qu&apos;il entre sa carte, ou utilisez Apple Pay / Google Pay.
          </p>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: { colorPrimary: '#d35400' },
              },
              locale: 'fr',
            }}
          >
            <PaymentForm
              totalTtc={totalTtc}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              onCancel={() => setStep('form')}
            />
          </Elements>
        </div>
      )}

      {/* STEP: SUCCESS */}
      {step === 'success' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-green-800">Paiement encaisse</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalTtc)}</p>
            </div>
            {createdInvoiceNumber && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Receipt className="h-4 w-4" />
                Facture {createdInvoiceNumber} creee automatiquement
              </div>
            )}
            <Button className="mt-4" size="lg" onClick={resetForm}>
              Nouvel encaissement
            </Button>
          </div>
        </div>
      )}

      {/* STEP: ERROR */}
      {step === 'error' && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <X className="h-7 w-7 text-red-600" />
            </div>
            <p className="text-sm text-red-800 text-center">{error}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={resetForm}>
              Recommencer
            </Button>
            {clientSecret && (
              <Button className="flex-1" onClick={() => setStep('payment')}>
                Reessayer
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
