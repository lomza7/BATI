'use client';

import { ArrowLeft, ArrowRight, Megaphone, SkipForward } from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

const sources = [
  { value: 'google', label: 'Recherche Google' },
  { value: 'social', label: 'Reseaux sociaux' },
  { value: 'bouche_a_oreille', label: 'Bouche a oreille' },
  { value: 'pub', label: 'Publicite en ligne' },
  { value: 'salon', label: 'Salon / Evenement pro' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'presse', label: 'Article / Blog' },
  { value: 'autre', label: 'Autre' },
];

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepReferral({ data, onChange, onNext, onBack, onSkip }: Props) {
  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Une derniere question
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Comment avez-vous entendu parler de Hellobat ?
      </p>

      <div className="mt-6 flex-1">
        <div className="grid grid-cols-2 gap-2">
          {sources.map((source) => (
            <button
              key={source.value}
              type="button"
              onClick={() => onChange({ referralSource: source.value })}
              className={`h-12 px-4 rounded-xl border text-sm text-left transition-all ${
                data.referralSource === source.value
                  ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
                  : 'border-border bg-white text-foreground hover:border-primary/30 hover:bg-muted/20'
              }`}
            >
              {source.label}
            </button>
          ))}
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
