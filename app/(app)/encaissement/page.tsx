'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadStripeTerminal } from '@stripe/terminal-js';
import type { Terminal, Reader } from '@stripe/terminal-js';
import {
  CreditCard,
  Loader2,
  Wifi,
  WifiOff,
  Check,
  X,
  Smartphone,
  RefreshCw,
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

type Step = 'form' | 'discover' | 'connecting' | 'ready' | 'collecting' | 'processing' | 'success' | 'error';

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

export default function EncaissementPage() {
  const { user, session } = useAuth();
  const terminalRef = useRef<Terminal | null>(null);

  // Stripe status
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [title, setTitle] = useState('');
  const [totalHt, setTotalHt] = useState<number>(0);
  const [tvaRate, setTvaRate] = useState(20);
  const [clientId, setClientId] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);

  // Terminal
  const [step, setStep] = useState<Step>('form');
  const [readers, setReaders] = useState<Reader[]>([]);
  const [selectedReader, setSelectedReader] = useState<Reader | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState('');

  // Created invoice
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
      .eq('payment_method', 'terminal')
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentPayments((data as RecentPayment[]) || []);
  }

  const fetchConnectionToken = useCallback(async () => {
    const res = await fetch('/api/stripe/terminal/connection-token', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur connection token');
    return data.secret;
  }, [session?.access_token]);

  async function initTerminalAndDiscover() {
    setStep('discover');
    setError('');
    setDiscovering(true);

    try {
      if (!terminalRef.current) {
        const StripeTerminal = await loadStripeTerminal();
        if (!StripeTerminal) throw new Error('Impossible de charger le SDK Terminal');

        const terminal = StripeTerminal.create({
          onFetchConnectionToken: fetchConnectionToken,
          onUnexpectedReaderDisconnect: () => {
            setStep('error');
            setError('Le lecteur a été déconnecté');
            setSelectedReader(null);
          },
        });
        terminalRef.current = terminal;
      }

      const result = await terminalRef.current.discoverReaders({ simulated: false });
      if ('error' in result && result.error) {
        setError(result.error.message || 'Impossible de trouver des lecteurs');
      } else if ('discoveredReaders' in result) {
        setReaders(result.discoveredReaders);
        if (result.discoveredReaders.length === 0) {
          setError('Aucun lecteur détecté. Vérifiez que votre lecteur est allumé et connecté au Wi-Fi.');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur découverte lecteurs');
    } finally {
      setDiscovering(false);
    }
  }

  async function connectToReader(reader: Reader) {
    const terminal = terminalRef.current;
    if (!terminal) return;

    setStep('connecting');
    setError('');

    try {
      const result = await terminal.connectReader(reader);
      if ('error' in result && result.error) {
        setError(result.error.message || 'Impossible de se connecter au lecteur');
        setStep('discover');
        return;
      }
      setSelectedReader(reader);
      setStep('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur connexion lecteur');
      setStep('discover');
    }
  }

  async function collectPayment() {
    const terminal = terminalRef.current;
    if (!terminal || !session?.access_token || !user) return;

    setStep('collecting');
    setError('');

    try {
      // 1. Create invoice in Hellobat
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
        title: title || 'Encaissement Terminal',
        total_ht: tva.total_ht,
        total_tva: tva.total_tva,
        total_ttc: tva.total_ttc,
        tva_rate: tva.primary_rate,
        tva_breakdown: tva.tva_breakdown,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'creee',
        issued_at: new Date().toISOString(),
        payment_method: 'terminal',
      }).select('id').single();

      if (!invoice) throw new Error('Erreur création facture');

      // Create invoice line
      if (totalHt > 0) {
        await supabase.from('invoice_lines').insert({
          user_id: user.id,
          invoice_id: invoice.id,
          description: title || 'Encaissement Terminal',
          quantity: 1,
          unit: 'forfait',
          unit_price: totalHt,
          tva_rate: tvaRate,
          total: totalHt,
          position: 0,
        });
      }

      setCreatedInvoiceNumber(invoiceNumber);

      // 2. Create PaymentIntent on backend
      const res = await fetch('/api/stripe/terminal/create-payment-intent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice_id: invoice.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur création paiement');

      // 3. Collect payment method from reader
      const collectResult = await terminal.collectPaymentMethod(data.clientSecret);
      if ('error' in collectResult && collectResult.error) {
        throw new Error(collectResult.error.message || 'Paiement annulé');
      }

      // 4. Process payment
      setStep('processing');
      const paymentIntent = 'paymentIntent' in collectResult
        ? collectResult.paymentIntent
        : collectResult;
      const processResult = await terminal.processPayment(
        paymentIntent as Parameters<Terminal['processPayment']>[0],
      );

      if ('error' in processResult && processResult.error) {
        throw new Error(processResult.error.message || 'Paiement refusé');
      }

      setStep('success');
      loadRecentPayments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur paiement');
      setStep('error');
    }
  }

  function resetForm() {
    setTitle('');
    setTotalHt(0);
    setTvaRate(20);
    setClientId(null);
    setBankAccountId(null);
    setStep('form');
    setError('');
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
        <PageHeader title="Encaissement" description="Encaissez vos clients en personne avec un lecteur de carte" />
        <div className="mt-8">
          <EmptyState
            icon={CreditCard}
            title="Stripe non connecté"
            description="Connectez votre compte Stripe dans la section Paiements pour pouvoir encaisser par Terminal."
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
      <PageHeader title="Encaissement" description="Encaissez vos clients en personne avec un lecteur de carte" />

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
              onClick={initTerminalAndDiscover}
              disabled={totalHt <= 0}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Encaisser {totalTtc > 0 ? formatCurrency(totalTtc) : ''}
            </Button>
          </div>

          {/* Recent Terminal payments */}
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

      {/* STEP: DISCOVER READERS */}
      {step === 'discover' && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-base font-semibold">Connexion au lecteur</h2>

          {discovering ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Recherche de lecteurs...</p>
            </div>
          ) : readers.length > 0 ? (
            <div className="space-y-2">
              {readers.map((reader) => (
                <button
                  key={reader.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
                  onClick={() => connectToReader(reader)}
                >
                  <Smartphone className="h-6 w-6 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {reader.label || reader.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reader.device_type} — {reader.status}
                    </p>
                  </div>
                  <Wifi className="h-4 w-4 text-green-500" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <WifiOff className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                {error || 'Aucun lecteur trouvé'}
              </p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Vérifiez que votre lecteur est allumé, connecté au Wi-Fi et sur le même réseau que votre appareil.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('form')}>
              Retour
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => initTerminalAndDiscover()} disabled={discovering}>
              <RefreshCw className="mr-2 h-4 w-4" /> Rechercher
            </Button>
          </div>
        </div>
      )}

      {/* STEP: CONNECTING */}
      {step === 'connecting' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Connexion au lecteur...</p>
          </div>
        </div>
      )}

      {/* STEP: READY — confirm payment */}
      {step === 'ready' && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
            <Wifi className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-800">
              Connecté à <span className="font-medium">{selectedReader?.label || selectedReader?.id}</span>
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/30 p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Objet</span>
              <span className="font-medium">{title || 'Encaissement Terminal'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Montant TTC</span>
              <span className="text-lg font-semibold">{formatCurrency(totalTtc)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('form')}>
              Annuler
            </Button>
            <Button className="flex-1" size="lg" onClick={collectPayment}>
              <CreditCard className="mr-2 h-4 w-4" />
              Encaisser
            </Button>
          </div>
        </div>
      )}

      {/* STEP: COLLECTING — waiting for card */}
      {step === 'collecting' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="relative">
              <CreditCard className="h-14 w-14 text-primary" />
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-400 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium">Présentez la carte</p>
              <p className="text-sm text-muted-foreground mt-1">{formatCurrency(totalTtc)}</p>
            </div>
            <p className="text-xs text-muted-foreground">En attente du paiement sur le lecteur...</p>
          </div>
        </div>
      )}

      {/* STEP: PROCESSING */}
      {step === 'processing' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Traitement du paiement...</p>
          </div>
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
              <p className="text-lg font-semibold text-green-800">Paiement encaissé</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalTtc)}</p>
            </div>
            {createdInvoiceNumber && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Receipt className="h-4 w-4" />
                Facture {createdInvoiceNumber} créée automatiquement
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
            <Button className="flex-1" onClick={() => setStep(selectedReader ? 'ready' : 'discover')}>
              Réessayer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
