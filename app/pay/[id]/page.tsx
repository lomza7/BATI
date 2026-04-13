'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { loadStripe, type Stripe, type PaymentRequest } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  PaymentRequestButtonElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Check, CreditCard, ShieldCheck } from 'lucide-react';

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface PaymentSession {
  id: string;
  stripe_account_id: string;
  client_secret: string;
  publishable_key: string;
  amount_cents: number;
  description: string | null;
  status: string;
  expires_at: string;
}

function formatEur(cents: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

// ---------- Inner payment form (inside Elements) ----------

function PayForm({
  amountCents,
  onSuccess,
}: {
  amountCents: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canPay, setCanPay] = useState<boolean | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  // Set up Payment Request (Apple Pay / Google Pay)
  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: 'FR',
      currency: 'eur',
      total: {
        label: 'HelloPay',
        amount: amountCents,
      },
      requestPayerName: true,
    });

    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        setCanPay(true);
      } else {
        setCanPay(false);
      }
    });

    pr.on('paymentmethod', async (ev) => {
      if (!elements) {
        ev.complete('fail');
        return;
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          payment_method: ev.paymentMethod.id,
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        ev.complete('fail');
        setError(confirmError.message || 'Le paiement a echoue');
      } else {
        ev.complete('success');
        onSuccess();
      }
    });
  }, [stripe, amountCents, elements, onSuccess]);

  async function handleCardSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setProcessing(false);
      setError(confirmError.message || 'Le paiement a echoue');
    } else {
      onSuccess();
    }
  }

  return (
    <div className="space-y-5">
      {/* Apple Pay / Google Pay button */}
      {canPay && paymentRequest && (
        <div>
          <PaymentRequestButtonElement
            options={{ paymentRequest }}
            className="w-full"
          />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-gray-400">ou payer par carte</span>
            </div>
          </div>
        </div>
      )}

      {canPay === false && (
        <p className="text-center text-xs text-gray-400 mb-2">
          Apple Pay / Google Pay non disponible sur cet appareil
        </p>
      )}

      {/* Card payment form */}
      <form onSubmit={handleCardSubmit}>
        <div className="rounded-lg border border-gray-200 p-4">
          <PaymentElement
            onReady={() => setReady(true)}
            options={{
              layout: 'tabs',
              wallets: { applePay: 'never', googlePay: 'never' },
            }}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 mt-2 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={!stripe || !ready || processing}
          className="w-full mt-4 py-3 px-4 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#D35400' }}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Traitement...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <CreditCard className="h-4 w-4" /> Payer {formatEur(amountCents)}
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

// ---------- Main public page ----------

export default function PublicPayPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<PaymentSession | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  async function loadSession() {
    if (!sessionId) return;

    const { data, error: fetchError } = await supabaseAnon
      .from('payment_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (fetchError || !data) {
      setError('Lien de paiement invalide ou expire');
      setLoading(false);
      return;
    }

    if (data.status !== 'pending') {
      setPaid(true);
      setSession(data as PaymentSession);
      setLoading(false);
      return;
    }

    if (new Date(data.expires_at) < new Date()) {
      setError('Ce lien de paiement a expire');
      setLoading(false);
      return;
    }

    setSession(data as PaymentSession);
    setStripePromise(
      loadStripe(data.publishable_key, { stripeAccount: data.stripe_account_id }),
    );
    setLoading(false);
  }

  const handleSuccess = useCallback(async () => {
    setPaid(true);
    // Mark session as completed
    if (session) {
      await supabaseAnon
        .from('payment_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">{error}</h1>
          <p className="text-sm text-gray-500">
            Veuillez demander un nouveau lien de paiement a votre artisan.
          </p>
        </div>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-green-800">Paiement reussi</h1>
          {session && (
            <p className="text-2xl font-bold text-gray-900">
              {formatEur(session.amount_cents)}
            </p>
          )}
          <p className="text-sm text-gray-500">Merci pour votre paiement.</p>
        </div>
      </div>
    );
  }

  if (!session || !stripePromise) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <span className="text-lg font-bold" style={{ color: '#D35400' }}>Hellobat</span>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Paiement securise
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="max-w-md w-full space-y-6">
          {/* Amount card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500 mb-1">Montant a regler</p>
            <p className="text-3xl font-bold text-gray-900">{formatEur(session.amount_cents)}</p>
            {session.description && (
              <p className="text-sm text-gray-500 mt-2">{session.description}</p>
            )}
          </div>

          {/* Payment form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: session.client_secret,
                appearance: {
                  theme: 'stripe',
                  variables: { colorPrimary: '#D35400' },
                },
                locale: 'fr',
              }}
            >
              <PayForm
                amountCents={session.amount_cents}
                onSuccess={handleSuccess}
              />
            </Elements>
          </div>

          <p className="text-center text-xs text-gray-400">
            Paiement traite par Stripe. Vos donnees bancaires ne sont jamais stockees.
          </p>
        </div>
      </main>
    </div>
  );
}
