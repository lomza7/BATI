'use client';

import { useCallback, useState } from 'react';
import { InsufficientCreditsModal } from '@/components/credits/insufficient-credits-modal';
import { UpgradeModal } from '@/components/paywall/upgrade-modal';

/**
 * Hook utilitaire pour toutes les actions IA côté client.
 *
 * Usage :
 *   const { callAi, Modals } = useAiGate();
 *   const res = await callAi(() => fetch('/api/ai/quote', ...));
 *   if (res) { ... } // null si gate a bloqué (modal déjà affiché)
 *
 *   return <>{Modals}...</>
 */
export function useAiGate() {
  const [insufficient, setInsufficient] = useState<{ balance: number; required: number } | null>(
    null,
  );
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const callAi = useCallback(
    async <T,>(fn: () => Promise<Response>): Promise<{ ok: true; data: T } | { ok: false }> => {
      const res = await fn();
      if (res.status === 402) {
        const body = await res.json().catch(() => ({}));
        setInsufficient({
          balance: typeof body.balance === 'number' ? body.balance : 0,
          required: typeof body.required === 'number' ? body.required : 0,
        });
        return { ok: false };
      }
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (typeof body.error === 'string' && body.error.toLowerCase().includes('pro')) {
          setUpgradeOpen(true);
          return { ok: false };
        }
      }
      if (!res.ok) {
        return { ok: false };
      }
      const data = (await res.json()) as T;
      return { ok: true, data };
    },
    [],
  );

  const Modals = (
    <>
      <InsufficientCreditsModal
        open={insufficient !== null}
        onOpenChange={(o) => !o && setInsufficient(null)}
        balance={insufficient?.balance ?? 0}
        required={insufficient?.required ?? 0}
      />
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );

  return { callAi, Modals };
}
