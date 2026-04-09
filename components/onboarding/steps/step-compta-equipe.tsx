'use client';

import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  SkipForward,
  Check,
  X,
  Plus,
  Sparkles,
  Users,
  Receipt,
  FileText,
  Bell,
  Info,
} from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

const ROLES = [
  { value: 'chef_equipe', label: "Chef d'équipe" },
  { value: 'commercial', label: 'Commercial' },
  { value: 'assistante', label: 'Assistant(e)' },
  { value: 'conducteur_travaux', label: 'Conducteur de travaux' },
  { value: 'admin', label: 'Admin' },
];

const MAURICE_ADVANTAGES = [
  {
    icon: Receipt,
    text: 'Scan automatique de vos factures par IA',
  },
  {
    icon: FileText,
    text: 'Rapprochement bancaire automatique',
  },
  {
    icon: Bell,
    text: 'Rappels fiscaux personnalisés',
  },
];

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepComptaEquipe({
  data,
  onChange,
  onNext,
  onBack,
  onSkip,
}: Props) {
  function addEmployee() {
    onChange({
      invitedEmployees: [
        ...data.invitedEmployees,
        { email: '', name: '', role: 'commercial' },
      ],
    });
  }

  function removeEmployee(index: number) {
    onChange({
      invitedEmployees: data.invitedEmployees.filter((_, i) => i !== index),
    });
  }

  function updateEmployee(
    index: number,
    field: 'email' | 'name' | 'role',
    value: string
  ) {
    onChange({
      invitedEmployees: data.invitedEmployees.map((e, i) =>
        i === index ? { ...e, [field]: value } : e
      ),
    });
  }

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Comptabilité & équipe
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Deux dernières questions pour personnaliser vos outils.
      </p>

      <div className="mt-6 space-y-6 flex-1">
        {/* ── Section A : Accounting ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-sm font-medium text-foreground">
              Vous avez déjà un logiciel de comptabilité ?
            </label>
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
              Le nôtre est gratuit
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                onChange({
                  hasAccountingSoftware: true,
                  wantsMaurice: false,
                })
              }
              className={`h-12 px-4 rounded-xl border text-sm transition-all flex items-center justify-center gap-2 ${
                data.hasAccountingSoftware === true
                  ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
                  : 'border-border bg-white text-foreground hover:border-primary/30'
              }`}
            >
              Oui
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  hasAccountingSoftware: false,
                  wantsMaurice: true,
                })
              }
              className={`h-12 px-4 rounded-xl border text-sm transition-all flex items-center justify-center gap-2 ${
                data.hasAccountingSoftware === false
                  ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
                  : 'border-border bg-white text-foreground hover:border-primary/30'
              }`}
            >
              Non
            </button>
          </div>

          {/* Maurice pitch */}
          {data.hasAccountingSoftware === false && (
            <div className="animate-fade-up rounded-2xl border border-primary/20 bg-primary/5 p-4 mt-2">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      Découvrez Maurice, votre comptable IA
                    </p>
                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-800">
                      Gratuit
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Inclus dans Hellobat. Pas de surcoût, pas de logiciel supplémentaire.
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {MAURICE_ADVANTAGES.map((adv) => (
                  <div key={adv.text} className="flex items-center gap-2">
                    <adv.icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <p className="text-xs text-foreground">{adv.text}</p>
                  </div>
                ))}
              </div>
              <label className="mt-3 flex items-center justify-between rounded-lg border border-border bg-white p-2.5 cursor-pointer">
                <span className="text-xs font-medium text-foreground">
                  Activer Maurice
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ wantsMaurice: !data.wantsMaurice })}
                  className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${
                    data.wantsMaurice ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      data.wantsMaurice ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            </div>
          )}

          {/* Small note: our accounting module is free too */}
          {data.hasAccountingSoftware === true && (
            <div className="animate-fade-up rounded-xl border border-emerald-200 bg-emerald-50 p-3 mt-2 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <Info className="h-3.5 w-3.5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-900">
                  Bon à savoir : le nôtre est inclus gratuitement
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                  Hellobat intègre Maurice, un comptable IA qui scanne vos factures
                  et fait votre compta automatiquement. Vous pourrez l&apos;activer
                  quand vous voulez depuis vos paramètres.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Section B : Employees ── */}
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-sm font-medium text-foreground pt-3 block">
            Vous avez des salariés ?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ hasEmployees: true })}
              className={`h-12 px-4 rounded-xl border text-sm transition-all flex items-center justify-center gap-2 ${
                data.hasEmployees === true
                  ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
                  : 'border-border bg-white text-foreground hover:border-primary/30'
              }`}
            >
              <Users className="h-4 w-4" />
              Oui
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ hasEmployees: false, invitedEmployees: [] })
              }
              className={`h-12 px-4 rounded-xl border text-sm transition-all flex items-center justify-center gap-2 ${
                data.hasEmployees === false
                  ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
                  : 'border-border bg-white text-foreground hover:border-primary/30'
              }`}
            >
              Non
            </button>
          </div>

          {/* Employee invitation form */}
          {data.hasEmployees === true && (
            <div className="animate-fade-up space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Invitez-les par email — ils rejoindront votre espace.
                </p>
                <button
                  type="button"
                  onClick={addEmployee}
                  className="h-8 px-3 rounded-lg bg-muted/50 text-xs font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </button>
              </div>

              {data.invitedEmployees.length === 0 && (
                <button
                  type="button"
                  onClick={addEmployee}
                  className="w-full h-14 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Inviter un premier salarié
                </button>
              )}

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {data.invitedEmployees.map((emp, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-muted/20 p-2.5 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="email"
                        value={emp.email}
                        onChange={(e) => updateEmployee(i, 'email', e.target.value)}
                        placeholder="email@exemple.fr"
                        className="flex h-9 flex-1 rounded-lg border border-border bg-white px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => removeEmployee(i)}
                        className="h-9 w-9 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={emp.name}
                        onChange={(e) => updateEmployee(i, 'name', e.target.value)}
                        placeholder="Nom (optionnel)"
                        className="flex h-9 flex-1 rounded-lg border border-border bg-white px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                      <select
                        value={emp.role}
                        onChange={(e) => updateEmployee(i, 'role', e.target.value)}
                        className="flex h-9 w-[140px] rounded-lg border border-border bg-white px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              {data.invitedEmployees.length > 0 && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <Check className="h-3 w-3" />
                  Les invitations seront envoyées après votre onboarding.
                </p>
              )}
            </div>
          )}
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
