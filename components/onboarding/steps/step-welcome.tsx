'use client';

import { ArrowRight, Sparkles, SkipForward } from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepWelcome({ data, onChange, onNext, onSkip }: Props) {
  const canProceed = data.fullName.trim().length >= 2;

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Bienvenue sur Hellobat !
      </h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Avant de commencer, on a besoin de quelques informations pour
        personnaliser votre espace. Ca ne prend que 2 minutes.
      </p>

      <div className="mt-8 space-y-4 flex-1">
        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium text-foreground">
            Comment vous appelez-vous ?
          </label>
          <input
            id="fullName"
            type="text"
            value={data.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            placeholder="Prenom et Nom"
            autoFocus
            className="flex h-12 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canProceed) onNext();
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-6">
        <button
          onClick={onSkip}
          className="h-11 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 hover:bg-muted/30 transition-all"
        >
          Passer
          <SkipForward className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Continuer
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
