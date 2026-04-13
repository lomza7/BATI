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
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Step = 'discover' | 'connecting' | 'ready' | 'collecting' | 'processing' | 'success' | 'error';

interface TerminalPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  totalTtc: number;
  onPaymentSuccess: () => void;
}

export function TerminalPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  totalTtc,
  onPaymentSuccess,
}: TerminalPaymentDialogProps) {
  const { session } = useAuth();
  const terminalRef = useRef<Terminal | null>(null);
  const [step, setStep] = useState<Step>('discover');
  const [readers, setReaders] = useState<Reader[]>([]);
  const [selectedReader, setSelectedReader] = useState<Reader | null>(null);
  const [error, setError] = useState('');
  const [discovering, setDiscovering] = useState(false);

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

  // Initialize Terminal SDK
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function init() {
      try {
        const StripeTerminal = await loadStripeTerminal();
        if (cancelled || !StripeTerminal) return;

        const terminal = StripeTerminal.create({
          onFetchConnectionToken: fetchConnectionToken,
          onUnexpectedReaderDisconnect: () => {
            setStep('error');
            setError('Le lecteur a été déconnecté');
            setSelectedReader(null);
          },
        });

        terminalRef.current = terminal;
        discoverReaders(terminal);
      } catch (e) {
        if (!cancelled) {
          setStep('error');
          setError(e instanceof Error ? e.message : 'Erreur initialisation Terminal');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (terminalRef.current) {
        terminalRef.current.disconnectReader();
        terminalRef.current = null;
      }
    };
  }, [open, fetchConnectionToken]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('discover');
      setReaders([]);
      setSelectedReader(null);
      setError('');
    }
  }, [open]);

  async function discoverReaders(terminal?: Terminal) {
    const t = terminal || terminalRef.current;
    if (!t) return;

    setDiscovering(true);
    setError('');

    try {
      const result = await t.discoverReaders({ simulated: false });
      if ('error' in result && result.error) {
        setError(result.error.message || 'Impossible de trouver des lecteurs');
        setStep('error');
      } else if ('discoveredReaders' in result) {
        setReaders(result.discoveredReaders);
        if (result.discoveredReaders.length === 0) {
          setError('Aucun lecteur détecté. Vérifiez que votre lecteur est allumé et connecté au Wi-Fi.');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur découverte lecteurs');
      setStep('error');
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
    if (!terminal || !session?.access_token) return;

    setStep('collecting');
    setError('');

    try {
      // Create PaymentIntent on backend
      const res = await fetch('/api/stripe/terminal/create-payment-intent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur création paiement');

      // Collect payment method from reader
      const collectResult = await terminal.collectPaymentMethod(data.clientSecret);
      if ('error' in collectResult && collectResult.error) {
        throw new Error(collectResult.error.message || 'Paiement annulé');
      }

      // Process payment
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
      // Delay to show success state before closing
      setTimeout(() => {
        onPaymentSuccess();
        onOpenChange(false);
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur paiement');
      setStep('error');
    }
  }

  function handleClose() {
    if (step === 'collecting' || step === 'processing') return; // Don't close during payment
    if (terminalRef.current) {
      terminalRef.current.disconnectReader();
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Encaisser par Terminal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Invoice info */}
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{invoiceNumber}</p>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(totalTtc)}</p>
          </div>

          {/* Step: Discover readers */}
          {step === 'discover' && (
            <div className="space-y-3">
              {discovering ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Recherche de lecteurs...</p>
                </div>
              ) : readers.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">Sélectionnez un lecteur :</p>
                  <div className="space-y-2">
                    {readers.map((reader) => (
                      <button
                        key={reader.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
                        onClick={() => connectToReader(reader)}
                      >
                        <Smartphone className="h-5 w-5 text-primary" />
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
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6">
                  <WifiOff className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    {error || 'Aucun lecteur trouvé'}
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => discoverReaders()}
                disabled={discovering}
              >
                {discovering ? 'Recherche...' : 'Rechercher des lecteurs'}
              </Button>
            </div>
          )}

          {/* Step: Connecting to reader */}
          {step === 'connecting' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connexion au lecteur...</p>
            </div>
          )}

          {/* Step: Ready to collect */}
          {step === 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                <Wifi className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-800">
                  Connecté à <span className="font-medium">{selectedReader?.label || selectedReader?.id}</span>
                </p>
              </div>
              <Button className="w-full" size="lg" onClick={collectPayment}>
                Encaisser {formatCurrency(totalTtc)}
              </Button>
            </div>
          )}

          {/* Step: Collecting — waiting for card */}
          {step === 'collecting' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="relative">
                <CreditCard className="h-10 w-10 text-primary" />
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-400 animate-pulse" />
              </div>
              <p className="text-sm font-medium">Présentez la carte sur le lecteur</p>
              <p className="text-xs text-muted-foreground">En attente du paiement...</p>
            </div>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Traitement du paiement...</p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-800">Paiement encaissé</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalTtc)}</p>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <X className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-sm text-red-800 text-center">{error}</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setError('');
                  setStep(selectedReader ? 'ready' : 'discover');
                }}
              >
                Réessayer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
