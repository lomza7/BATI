'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Zap, Smartphone } from 'lucide-react';

type Step = 'idle' | 'waiting' | 'success';

const WAIT_MS = 3000;
const SUCCESS_MS = 2800;
const IDLE_MS = 1800;

export function HelloPayInteractiveDemo() {
  const [step, setStep] = useState<Step>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (step === 'idle') {
      timer.current = setTimeout(() => setStep('waiting'), IDLE_MS);
    } else if (step === 'waiting') {
      timer.current = setTimeout(() => setStep('success'), WAIT_MS);
    } else if (step === 'success') {
      timer.current = setTimeout(() => setStep('idle'), SUCCESS_MS);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [step]);

  function handleEncaisser() {
    setStep('waiting');
  }

  return (
    <div className="relative mx-auto max-w-[280px]">
      <div className="rounded-[2rem] border-[3px] border-gray-800 bg-white shadow-2xl overflow-hidden">
        <div className="bg-gray-800 h-6 flex items-center justify-center">
          <div className="w-16 h-3 bg-gray-900 rounded-full" />
        </div>

        <div className="p-4 space-y-4 min-h-[440px]">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm">HelloPay</span>
            <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-600 border border-amber-200/60">
              ✨ Nouveau
            </span>
          </div>

          <div className="space-y-2">
            <div className="rounded-lg bg-gray-50 p-2">
              <div className="text-[8px] text-gray-400 mb-0.5">Objet</div>
              <div className="text-[10px] font-medium">Renovation salle de bain</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <div className="text-[8px] text-gray-400 mb-0.5">Client</div>
              <div className="text-[10px] font-medium">M. Dupont</div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg bg-gray-50 p-2">
                <div className="text-[8px] text-gray-400 mb-0.5">Montant HT</div>
                <div className="text-[10px] font-bold">3 500,00 EUR</div>
              </div>
              <div className="flex-1 rounded-lg bg-gray-50 p-2">
                <div className="text-[8px] text-gray-400 mb-0.5">TVA</div>
                <div className="text-[10px] font-medium">10%</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-orange-50 border border-orange-200/50 p-2 flex justify-between items-center">
            <span className="text-[9px] text-orange-600">TTC</span>
            <span className="text-sm font-bold text-orange-700">3 850,00 EUR</span>
          </div>

          {step === 'idle' ? (
            <button
              type="button"
              onClick={handleEncaisser}
              className="w-full rounded-xl bg-gradient-to-r from-[#d35400] to-orange-500 text-white text-center py-2.5 text-xs font-semibold shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] transition-all animate-[pulse_2s_ease-in-out_infinite]"
            >
              ⚡ Encaisser 3 850,00 EUR
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 pt-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-[9px] text-gray-400 font-medium flex items-center gap-1">
                <Smartphone className="w-2.5 h-2.5" />
                LE CLIENT SCANNE
              </div>
              <div className="w-24 h-24 bg-gray-900 rounded-lg p-1.5 flex items-center justify-center">
                <div className="grid grid-cols-5 gap-[2px] w-full h-full">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-[1px] ${
                        [0, 1, 2, 4, 5, 6, 10, 12, 14, 15, 16, 18, 19, 20, 21, 22, 24].includes(i)
                          ? 'bg-white'
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                En attente du paiement...
              </div>
            </div>
          )}
        </div>

        <div className="h-4 flex items-center justify-center">
          <div className="w-20 h-1 bg-gray-300 rounded-full" />
        </div>
      </div>

      {step === 'success' && (
        <div
          key="success-popup"
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-[92%] animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        >
          <div className="rounded-2xl bg-white border border-emerald-200 shadow-2xl shadow-emerald-500/20 p-4 flex items-center gap-3 ring-4 ring-emerald-500/10">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
              <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                <Check className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                Paiement reçu
              </div>
              <div className="text-base font-bold text-gray-900 truncate">+ 3 850,00 €</div>
              <div className="text-[10px] text-gray-500">Facture créée · M. Dupont</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
