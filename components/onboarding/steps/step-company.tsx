'use client';

import { ArrowLeft, ArrowRight, Building2 } from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

const activities = [
  'Plomberie',
  'Electricite',
  'Peinture',
  'Carrelage',
  'Maconnerie',
  'Menuiserie',
  'Couverture',
  'Chauffage / Clim',
  'Renovation generale',
  'Autre',
];

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepCompany({ data, onChange, onNext, onBack }: Props) {
  const canProceed = data.companyName.trim().length >= 2 && data.companyActivity.trim().length > 0;

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Parlez-nous de votre entreprise
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Ces informations nous permettent d&apos;adapter l&apos;interface a votre activite.
      </p>

      <div className="mt-6 space-y-4 flex-1">
        <div className="space-y-2">
          <label htmlFor="companyName" className="text-sm font-medium text-foreground">
            Nom de l&apos;entreprise
          </label>
          <input
            id="companyName"
            type="text"
            value={data.companyName}
            onChange={(e) => onChange({ companyName: e.target.value })}
            placeholder="Ex: Martin Plomberie"
            autoFocus
            className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Activite principale</label>
          <div className="grid grid-cols-2 gap-2">
            {activities.map((activity) => (
              <button
                key={activity}
                type="button"
                onClick={() => onChange({ companyActivity: activity })}
                className={`h-10 px-3 rounded-lg border text-sm text-left transition-all ${
                  data.companyActivity === activity
                    ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
                    : 'border-border bg-white text-foreground hover:border-primary/30 hover:bg-muted/20'
                }`}
              >
                {activity}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="companyCity" className="text-sm font-medium text-foreground">
              Ville
            </label>
            <input
              id="companyCity"
              type="text"
              value={data.companyCity}
              onChange={(e) => onChange({ companyCity: e.target.value })}
              placeholder="Ex: Lyon"
              className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="companyPhone" className="text-sm font-medium text-foreground">
              Telephone
            </label>
            <input
              id="companyPhone"
              type="tel"
              value={data.companyPhone}
              onChange={(e) => onChange({ companyPhone: e.target.value })}
              placeholder="06 12 34 56 78"
              className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          className="h-11 px-5 rounded-xl border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
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
