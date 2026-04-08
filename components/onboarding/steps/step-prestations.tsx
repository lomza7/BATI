'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Wrench,
  SkipForward,
  Check,
  Hammer,
  Paintbrush,
  Zap,
  Droplets,
  Home,
  Thermometer,
  Layers,
  TreePine,
  HardHat,
  Pipette,
  Plug,
  Settings,
  Search,
  Wind,
  Bath,
  Key,
  Waves,
  Sun,
  Cpu,
  Axe,
  ChefHat,
  Trees,
  Building,
  Grid2x2,
  Square,
  MoreHorizontal,
} from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

const BTP_CATEGORIES: {
  value: string;
  label: string;
  icon: typeof Hammer;
  nafKeywords: string[];
}[] = [
  { value: 'maconnerie', label: 'Maconnerie', icon: HardHat, nafKeywords: ['macon', 'gros oeuvre', 'beton'] },
  { value: 'plomberie', label: 'Plomberie', icon: Droplets, nafKeywords: ['plomb', 'sanitaire'] },
  { value: 'electricite', label: 'Electricite', icon: Zap, nafKeywords: ['electri'] },
  { value: 'peinture', label: 'Peinture', icon: Paintbrush, nafKeywords: ['peint', 'revetement'] },
  { value: 'carrelage', label: 'Carrelage', icon: Grid2x2, nafKeywords: ['carrel'] },
  { value: 'menuiserie', label: 'Menuiserie', icon: Hammer, nafKeywords: ['menuise', 'bois'] },
  { value: 'charpente', label: 'Charpente', icon: TreePine, nafKeywords: ['charpent'] },
  { value: 'couverture', label: 'Couverture / Zinguerie', icon: Home, nafKeywords: ['couvert', 'zingu'] },
  { value: 'toiture', label: 'Toiture', icon: Home, nafKeywords: ['toitur'] },
  { value: 'etancheite', label: 'Etancheite', icon: Droplets, nafKeywords: ['etanche'] },
  { value: 'isolation', label: 'Isolation', icon: Layers, nafKeywords: ['isol', 'thermique'] },
  { value: 'chauffage', label: 'Chauffage', icon: Thermometer, nafKeywords: ['chauff'] },
  { value: 'climatisation', label: 'Climatisation', icon: Wind, nafKeywords: ['clim', 'froid'] },
  { value: 'terrassement', label: 'Terrassement', icon: TreePine, nafKeywords: ['terrass'] },
  { value: 'demolition', label: 'Demolition', icon: Axe, nafKeywords: ['demolit'] },
  { value: 'vrd', label: 'VRD / Assainissement', icon: Pipette, nafKeywords: ['vrd', 'voirie', 'reseau', 'assainiss'] },
  { value: 'facade', label: 'Facade / Ravalement', icon: Building, nafKeywords: ['ravalement', 'facade'] },
  { value: 'platrerie', label: 'Platrerie', icon: Square, nafKeywords: ['platr'] },
  { value: 'placo', label: 'Placoplatre / Cloisons', icon: Settings, nafKeywords: ['placo', 'cloison'] },
  { value: 'serrurerie', label: 'Serrurerie / Metallerie', icon: Key, nafKeywords: ['serrur', 'metall', 'metaux'] },
  { value: 'ferronnerie', label: 'Ferronnerie', icon: Hammer, nafKeywords: ['ferronn'] },
  { value: 'vitrerie', label: 'Vitrerie / Miroiterie', icon: Square, nafKeywords: ['vitre', 'miroit', 'verre'] },
  { value: 'parquet', label: 'Parquet / Sols souples', icon: Layers, nafKeywords: ['parquet', 'sol', 'revetement'] },
  { value: 'cuisiniste', label: 'Cuisiniste', icon: ChefHat, nafKeywords: ['cuisine', 'cuisinist'] },
  { value: 'salle_de_bain', label: 'Salle de bain', icon: Bath, nafKeywords: ['salle de bain', 'sanitaire'] },
  { value: 'paysagisme', label: 'Paysagisme', icon: Trees, nafKeywords: ['paysag', 'espaces verts', 'jardin'] },
  { value: 'piscine', label: 'Piscine', icon: Waves, nafKeywords: ['piscine'] },
  { value: 'photovoltaique', label: 'Photovoltaique', icon: Sun, nafKeywords: ['photovolta', 'solaire', 'panneau'] },
  { value: 'domotique', label: 'Domotique', icon: Cpu, nafKeywords: ['domotique', 'smart', 'automat'] },
  { value: 'autre', label: 'Autre', icon: MoreHorizontal, nafKeywords: [] },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function autoDetectCategories(nafLabel: string, activity: string): string[] {
  const haystack = `${nafLabel} ${activity}`.toLowerCase();
  if (!haystack.trim()) return [];
  return BTP_CATEGORIES.filter((cat) =>
    cat.nafKeywords.some((kw) => haystack.includes(kw))
  ).map((c) => c.value);
}

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepPrestations({ data, onChange, onNext, onBack, onSkip }: Props) {
  const [search, setSearch] = useState('');

  // Pre-check categories matching NAF code the first time we land on this step
  useEffect(() => {
    if (data.serviceCategories.length === 0) {
      const detected = autoDetectCategories(data.nafLabel, data.companyActivity);
      if (detected.length > 0) {
        onChange({ serviceCategories: detected });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCategory(value: string) {
    const current = data.serviceCategories;
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ serviceCategories: updated });
  }

  const filteredCategories = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return BTP_CATEGORIES;
    return BTP_CATEGORIES.filter((cat) =>
      normalize(cat.label).includes(q) ||
      cat.nafKeywords.some((kw) => normalize(kw).includes(q))
    );
  }, [search]);

  const selectedCount = data.serviceCategories.length;

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wrench className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Vos prestations
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Selectionnez vos specialites. On creera les categories dans votre
        bibliotheque de prestations.
      </p>

      <div className="mt-6 flex-1">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un metier..."
            className="flex h-10 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {filteredCategories.map((cat) => {
            const selected = data.serviceCategories.includes(cat.value);
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => toggleCategory(cat.value)}
                className={`relative aspect-square rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 p-2 ${
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border bg-white hover:border-primary/30'
                }`}
              >
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`text-[11px] leading-tight text-center ${
                    selected ? 'text-primary font-medium' : 'text-foreground'
                  }`}
                >
                  {cat.label}
                </span>
                {selected && (
                  <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {filteredCategories.length === 0 && (
          <div className="mt-4 rounded-xl border border-border bg-muted/20 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun metier trouve pour &laquo; {search} &raquo;
            </p>
          </div>
        )}

        {selectedCount > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2 animate-fade-up">
            <Plug className="h-4 w-4 text-emerald-700" />
            <p className="text-xs text-emerald-800">
              {selectedCount} categorie{selectedCount > 1 ? 's' : ''} selectionnee
              {selectedCount > 1 ? 's' : ''}. Vous pourrez ajouter vos propres
              prestations ensuite.
            </p>
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

export { BTP_CATEGORIES };
