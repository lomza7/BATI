'use client';

import {
  ArrowLeft,
  ArrowRight,
  Globe2,
  SkipForward,
  Info,
  Check,
  Search,
  Star,
  Sparkles,
  Rocket,
} from 'lucide-react';
import { SITE_THEMES, type SiteTheme } from '@/lib/site-utils';
import type { OnboardingData } from '../onboarding-modal';

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const ADVANTAGES = [
  {
    icon: Search,
    title: 'Referencement Google local',
    description: 'Votre site optimise pour apparaitre sur "plombier Lyon" et similaires.',
  },
  {
    icon: Star,
    title: 'Avis Google integres',
    description: 'Vos avis clients s\'affichent automatiquement et rassurent vos prospects.',
  },
  {
    icon: Sparkles,
    title: 'Publication chantiers',
    description: 'Chaque chantier publie devient une page SEO avec photos et description.',
  },
  {
    icon: Rocket,
    title: 'Inclus gratuitement',
    description: 'Pas de frais d\'hebergement ou de developpeur. Tout est inclus.',
  },
];

export function StepSiteWeb({ data, onChange, onNext, onBack, onSkip }: Props) {
  const answered = data.hasExistingWebsite !== null;

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Globe2 className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Avez-vous deja un site web ?
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        On peut vous en creer un gratuitement, optimise SEO et relie a Hellobat.
      </p>

      <div className="mt-6 space-y-5 flex-1">
        {/* Yes / No cards */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              onChange({ hasExistingWebsite: true, wantsHellobatSite: false })
            }
            className={`h-14 px-4 rounded-xl border text-left transition-all flex items-center gap-3 ${
              data.hasExistingWebsite === true
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border bg-white hover:border-primary/30'
            }`}
          >
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                data.hasExistingWebsite === true
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Check className="h-4 w-4" />
            </div>
            <span
              className={`text-sm ${
                data.hasExistingWebsite === true
                  ? 'text-primary font-medium'
                  : 'text-foreground'
              }`}
            >
              Oui, j&apos;ai deja un site
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({ hasExistingWebsite: false, wantsHellobatSite: true })
            }
            className={`h-14 px-4 rounded-xl border text-left transition-all flex items-center gap-3 ${
              data.hasExistingWebsite === false
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border bg-white hover:border-primary/30'
            }`}
          >
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                data.hasExistingWebsite === false
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Globe2 className="h-4 w-4" />
            </div>
            <span
              className={`text-sm ${
                data.hasExistingWebsite === false
                  ? 'text-primary font-medium'
                  : 'text-foreground'
              }`}
            >
              Non, pas encore
            </span>
          </button>
        </div>

        {/* State: Yes → SEO info */}
        {data.hasExistingWebsite === true && (
          <div className="animate-fade-up rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Info className="h-4 w-4" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-amber-900">
                  Un seul site, c&apos;est mieux pour le SEO
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Avoir deux sites web dilue votre referencement Google. On vous
                  recommande de garder votre site actuel comme vitrine
                  principale. Vous pourrez toujours activer un site Hellobat plus
                  tard si besoin depuis vos parametres.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* State: No → pitch + theme picker */}
        {data.hasExistingWebsite === false && (
          <div className="animate-fade-up space-y-4">
            {/* Advantages */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                Ce que Hellobat fait pour vous :
              </p>
              <div className="space-y-2.5">
                {ADVANTAGES.map((adv) => (
                  <div key={adv.title} className="flex items-start gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-white border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <adv.icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{adv.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {adv.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Theme picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Choisissez un style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SITE_THEMES) as SiteTheme[]).map((key) => {
                  const theme = SITE_THEMES[key];
                  const selected = data.siteTheme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onChange({ siteTheme: key })}
                      className={`relative rounded-xl border-2 overflow-hidden transition-all text-left ${
                        selected
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div
                        className="h-16 flex items-end p-2"
                        style={{ backgroundColor: theme.bg }}
                      >
                        <div
                          className="h-2 w-12 rounded-full"
                          style={{ backgroundColor: theme.accent }}
                        />
                      </div>
                      <div className="px-3 py-2 bg-white">
                        <p className="text-xs font-semibold text-foreground">
                          {theme.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {theme.tagline}
                        </p>
                      </div>
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                          <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle generate */}
            <label className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3 cursor-pointer">
              <div className="flex items-start gap-2.5 min-w-0">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Generer mon site Hellobat
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    On le prepare pendant que vous decouvrez l&apos;app.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange({ wantsHellobatSite: !data.wantsHellobatSite })}
                className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${
                  data.wantsHellobatSite ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                aria-label="Activer la generation du site"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    data.wantsHellobatSite ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          </div>
        )}
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
            disabled={!answered}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Continuer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
