'use client';

import { ArrowLeft, ArrowRight, Users, Plus, X } from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

const teamSizes = [
  { value: 'seul', label: 'Je travaille seul', emoji: '1' },
  { value: '2-5', label: '2 a 5 personnes', emoji: '2-5' },
  { value: '6-10', label: '6 a 10 personnes', emoji: '6-10' },
  { value: '10+', label: 'Plus de 10', emoji: '10+' },
];

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepTeam({ data, onChange, onNext, onBack }: Props) {
  const showMembers = data.teamSize !== 'seul';

  function addMember() {
    onChange({
      teamMembers: [...data.teamMembers, { name: '', role: '' }],
    });
  }

  function removeMember(index: number) {
    onChange({
      teamMembers: data.teamMembers.filter((_, i) => i !== index),
    });
  }

  function updateMember(index: number, field: 'name' | 'role', value: string) {
    const updated = data.teamMembers.map((m, i) =>
      i === index ? { ...m, [field]: value } : m
    );
    onChange({ teamMembers: updated });
  }

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Votre equipe
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Combien de personnes travaillent avec vous ?
      </p>

      <div className="mt-6 space-y-5 flex-1">
        <div className="grid grid-cols-2 gap-2">
          {teamSizes.map((size) => (
            <button
              key={size.value}
              type="button"
              onClick={() => {
                onChange({
                  teamSize: size.value,
                  teamMembers: size.value === 'seul' ? [] : data.teamMembers,
                });
              }}
              className={`h-14 px-4 rounded-xl border text-left transition-all flex items-center gap-3 ${
                data.teamSize === size.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-white hover:border-primary/30'
              }`}
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                data.teamSize === size.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {size.emoji}
              </div>
              <span className={`text-sm ${
                data.teamSize === size.value ? 'text-primary font-medium' : 'text-foreground'
              }`}>
                {size.label}
              </span>
            </button>
          ))}
        </div>

        {showMembers && (
          <div className="space-y-3 animate-fade-up">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Membres de l&apos;equipe
                <span className="text-muted-foreground font-normal ml-1">(optionnel)</span>
              </p>
              <button
                type="button"
                onClick={addMember}
                className="h-8 px-3 rounded-lg bg-muted/50 text-xs font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </button>
            </div>

            {data.teamMembers.length === 0 && (
              <button
                type="button"
                onClick={addMember}
                className="w-full h-16 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="h-4 w-4" />
                Ajouter un premier membre
              </button>
            )}

            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {data.teamMembers.map((member, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateMember(i, 'name', e.target.value)}
                    placeholder="Nom"
                    className="flex h-10 flex-1 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                  />
                  <input
                    type="text"
                    value={member.role}
                    onChange={(e) => updateMember(i, 'role', e.target.value)}
                    placeholder="Poste"
                    className="flex h-10 w-[140px] rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    className="h-10 w-10 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
          className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 transition-all"
        >
          Continuer
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
