'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export type Plan = 'free' | 'pro';
export type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'free';

export type AiFeature =
  | 'quote_ai'
  | 'agent'
  | 'email_ai'
  | 'accounting_ai'
  | 'before_after'
  | 'site_web';

export interface AccessState {
  plan: Plan;
  status: SubStatus;
  trialEndAt: string | null;
  daysLeftInTrial: number | null;
  hasProAccess: boolean;
  /** Total affiché (mensuel restant + permanents). */
  creditsBalance: number;
  monthlyCreditsRemaining: number;
  monthlyCreditsAllocation: number;
  purchasedCreditsBalance: number;
  creditsNextRefillAt: string | null;
  usage: Record<AiFeature, number>;
  docUsage: { quote: number; invoice: number };
  docLimit: number;
  creditCosts: Record<AiFeature, number>;
}

export function useAccessState() {
  const { session } = useAuth();
  const [state, setState] = useState<AccessState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/me/access', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setState((await res.json()) as AccessState);
      }
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    refresh();
    // Ré-abonnement sur changements de profil (crédits, plan)
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`access-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, refresh]);

  return { state, loading, refresh };
}
