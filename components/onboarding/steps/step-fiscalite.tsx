'use client';

import {
  ArrowLeft,
  ArrowRight,
  Receipt,
  SkipForward,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

const VAT_REGIMES = [
  {
    value: 'franchise',
    label: 'Franchise en base',
    description: 'Pas de TVA a facturer (CA < 36 800 EUR services)',
  },
  {
    value: 'simplifie',
    label: 'Reel simplifie',
    description: 'Declaration annuelle avec 2 acomptes',
  },
  {
    value: 'normal',
    label: 'Reel normal',
    description: 'Declaration mensuelle ou trimestrielle',
  },
  {
    value: 'auto',
    label: 'Auto-entrepreneur',
    description: 'Regime micro-entreprise',
  },
];

const VAT_FREQUENCIES = [
  { value: 'mensuel', label: 'Mensuelle' },
  { value: 'trimestriel', label: 'Trimestrielle' },
  { value: 'annuel', label: 'Annuelle' },
];

const MONTHS = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Fevrier' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Aout' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Decembre' },
];

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepFiscalite({ data, onChange, onNext, onBack, onSkip }: Props) {
  const isFranchise = data.vatRegime === 'franchise' || data.vatRegime === 'auto';

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Fiscalite & TVA
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        On va configurer vos rappels TVA et echeances fiscales automatiquement.
      </p>

      <div className="mt-6 space-y-5 flex-1">
        {/* VAT regime */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Votre regime de TVA
          </label>
          <div className="grid grid-cols-2 gap-2">
            {VAT_REGIMES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => onChange({ vatRegime: r.value })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  data.vatRegime === r.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border bg-white hover:border-primary/30'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    data.vatRegime === r.value ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {r.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {r.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* VAT frequency — hidden if franchise/auto */}
        {!isFranchise && data.vatRegime && (
          <div className="space-y-2 animate-fade-up">
            <label className="text-sm font-medium text-foreground">
              Frequence de declaration TVA
            </label>
            <div className="grid grid-cols-3 gap-2">
              {VAT_FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => onChange({ vatFrequency: f.value })}
                  className={`h-11 px-3 rounded-xl border text-sm transition-all ${
                    data.vatFrequency === f.value
                      ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
                      : 'border-border bg-white text-foreground hover:border-primary/30'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reminder day */}
        {!isFranchise && data.vatFrequency && (
          <div className="space-y-2 animate-fade-up">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Rappel avant echeance (jour du mois)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={28}
                value={data.vatReminderDay}
                onChange={(e) => onChange({ vatReminderDay: Number(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="h-10 w-14 rounded-lg border border-border bg-white flex items-center justify-center text-sm font-semibold text-primary">
                {data.vatReminderDay}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              On vous rappellera le {data.vatReminderDay} de chaque mois pour preparer votre
              declaration.
            </p>
          </div>
        )}

        {/* Fiscal year end */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Fin d&apos;exercice comptable
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={data.fiscalYearEndDay}
              onChange={(e) => onChange({ fiscalYearEndDay: Number(e.target.value) })}
              className="flex h-11 rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Jour {d}
                </option>
              ))}
            </select>
            <select
              value={data.fiscalYearEndMonth}
              onChange={(e) => onChange({ fiscalYearEndMonth: Number(e.target.value) })}
              className="flex h-11 rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Par defaut : 31 decembre (annee civile).
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={onBack}
          className="h-11 px-5 rounded-xl border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onSkip}
            className="h-11 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 hover:bg-muted/30 transition-all"
          >
            Passer
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onNext}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            Continuer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
