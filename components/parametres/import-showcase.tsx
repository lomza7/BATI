'use client';

/**
 * ImportShowcase — the marketing-grade landing page for the Import tab in the
 * settings. Sells the value proposition (3-clic migration from any other BTP
 * software) and lets the user pick their source software directly from a
 * single grid of clickable logo tiles.
 *
 * Design intent (per latest user feedback):
 *   - There is NO separate "Lancer l'import" button at the bottom. Each
 *     software tile *is* the call to action — clicking it opens the import
 *     modal pre-loaded with that source.
 *   - "Autre" was replaced by Excel, which is highlighted as the universal
 *     fallback alongside Costructor (the most-used BTP tool).
 *   - The bibliothèque-de-prix slot is now fully supported, so the "Bientôt"
 *     badge has been removed from the entities list.
 *
 * The component is presentational only — the parent owns the modal state and
 * receives the chosen source id through `onLaunch(sourceId)`.
 */

import {
  Sparkles,
  Users,
  FileText,
  Receipt,
  Package,
  CheckCircle2,
  Shield,
  Zap,
  Clock,
  Database,
} from 'lucide-react';

interface Props {
  onLaunch: (sourceId: SourceId) => void;
}

export type SourceId =
  | 'costructor'
  | 'obat'
  | 'tolteck'
  | 'mediabat'
  | 'ebp'
  | 'sage'
  | 'henrri'
  | 'codial'
  | 'devisoc'
  | 'extrabat'
  | 'batappli'
  | 'excel';

// ── Catalogue of supported sources ──────────────────────────────────────────
// Each entry carries the brand-ish color combo we use to fake a logo tile
// (we don't ship third-party trademarked artwork). Costructor and Excel get
// a featured badge so users instantly spot the two most-likely paths.

interface Source {
  id: SourceId;
  name: string;
  /** Short wordmark shown inside the colored square (1-3 chars). */
  wordmark: string;
  badge?: string;
  /** Tailwind background gradient for the logo square. */
  bg: string;
  /** Tailwind text color for the wordmark. */
  fg: string;
  /** Tailwind ring color used on hover. */
  ring: string;
  /** Optional second-line caption shown under the name. */
  caption?: string;
}

const SUPPORTED_SOURCES: Source[] = [
  {
    id: 'costructor',
    name: 'Costructor',
    wordmark: 'C',
    badge: 'Le plus utilisé',
    bg: 'bg-gradient-to-br from-orange-500 to-orange-600',
    fg: 'text-white',
    ring: 'hover:ring-orange-300',
    caption: 'BTP français',
  },
  {
    id: 'excel',
    name: 'Excel',
    wordmark: 'X',
    badge: 'Universel',
    bg: 'bg-gradient-to-br from-emerald-600 to-emerald-700',
    fg: 'text-white',
    ring: 'hover:ring-emerald-300',
    caption: 'CSV / Sheets',
  },
  {
    id: 'obat',
    name: 'Obat',
    wordmark: 'Ob',
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    fg: 'text-white',
    ring: 'hover:ring-blue-300',
  },
  {
    id: 'tolteck',
    name: 'Tolteck',
    wordmark: 'T',
    bg: 'bg-gradient-to-br from-violet-500 to-violet-600',
    fg: 'text-white',
    ring: 'hover:ring-violet-300',
  },
  {
    id: 'mediabat',
    name: 'Mediabat',
    wordmark: 'Mb',
    bg: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
    fg: 'text-white',
    ring: 'hover:ring-cyan-300',
  },
  {
    id: 'ebp',
    name: 'EBP',
    wordmark: 'EBP',
    bg: 'bg-gradient-to-br from-red-500 to-red-600',
    fg: 'text-white',
    ring: 'hover:ring-red-300',
  },
  {
    id: 'sage',
    name: 'Sage',
    wordmark: 'S',
    bg: 'bg-gradient-to-br from-green-600 to-green-700',
    fg: 'text-white',
    ring: 'hover:ring-green-300',
  },
  {
    id: 'henrri',
    name: 'Henrri',
    wordmark: 'H',
    bg: 'bg-gradient-to-br from-pink-500 to-pink-600',
    fg: 'text-white',
    ring: 'hover:ring-pink-300',
  },
  {
    id: 'codial',
    name: 'Codial',
    wordmark: 'Cd',
    bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    fg: 'text-white',
    ring: 'hover:ring-amber-300',
  },
  {
    id: 'devisoc',
    name: 'Devisoc',
    wordmark: 'Dv',
    bg: 'bg-gradient-to-br from-rose-500 to-rose-600',
    fg: 'text-white',
    ring: 'hover:ring-rose-300',
  },
  {
    id: 'extrabat',
    name: 'Extrabat',
    wordmark: 'Ex',
    bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    fg: 'text-white',
    ring: 'hover:ring-indigo-300',
  },
  {
    id: 'batappli',
    name: 'Batappli',
    wordmark: 'Ba',
    bg: 'bg-gradient-to-br from-teal-500 to-teal-600',
    fg: 'text-white',
    ring: 'hover:ring-teal-300',
  },
];

const ENTITIES = [
  {
    icon: Users,
    title: 'Tous vos clients',
    description: 'Coordonnées, adresses, types (clients, prospects), notes commerciales.',
  },
  {
    icon: FileText,
    title: 'Tous vos devis',
    description: 'Avec leurs montants, statuts, dates et le client associé.',
  },
  {
    icon: Receipt,
    title: 'Toutes vos factures',
    description: 'Émises, payées, en retard — liées automatiquement à leur devis.',
  },
  {
    icon: Package,
    title: 'Bibliothèque de prix',
    description: 'Vos prestations, fournitures et tarifs réutilisables dans vos devis.',
  },
];

const PERKS = [
  {
    icon: Zap,
    title: 'En 3 clics',
    description: 'Cliquez sur votre logiciel ci-dessous, joignez vos fichiers, c\'est terminé.',
  },
  {
    icon: Shield,
    title: 'Sans risque',
    description: 'Prévisualisation complète avant d\'écrire en base.',
  },
  {
    icon: Clock,
    title: 'Moins d\'1 minute',
    description: 'Centaines de lignes traitées en quelques secondes.',
  },
];

export function ImportShowcase({ onLaunch }: Props) {
  return (
    <div className="space-y-6">
      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-white">
        {/* Decorative dotted background */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '14px 14px',
            color: '#d35400',
          }}
        />
        <div className="relative p-6 sm:p-10 flex flex-col lg:flex-row gap-8 items-center">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-white border border-primary/20 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3 w-3" />
              Nouveau · Import en 3 clics
            </span>
            <h2 className="mt-4 text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              Migrez vos données{' '}
              <span className="text-primary">sans rien perdre</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
              Transférez vos clients, devis, factures et bibliothèque de prix
              depuis votre logiciel actuel. Hellobat reconnaît automatiquement
              vos colonnes — vous n&apos;avez rien à configurer.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-primary">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Inclus dans tous les forfaits — cliquez sur votre logiciel ci-dessous
            </div>
          </div>

          {/* Visual on the right — stack of file cards */}
          <div className="hidden lg:flex flex-shrink-0 relative h-48 w-64">
            <div className="absolute top-0 right-12 h-32 w-44 rounded-2xl bg-white border border-border shadow-lg rotate-[-6deg] p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <p className="text-[11px] font-semibold text-foreground">clients.csv</p>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-muted" />
                <div className="h-1.5 w-3/4 rounded-full bg-muted" />
                <div className="h-1.5 w-5/6 rounded-full bg-muted" />
              </div>
            </div>
            <div className="absolute top-8 right-0 h-32 w-44 rounded-2xl bg-white border border-border shadow-lg rotate-[3deg] p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-violet-50 flex items-center justify-center">
                  <FileText className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <p className="text-[11px] font-semibold text-foreground">devis.csv</p>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-muted" />
                <div className="h-1.5 w-2/3 rounded-full bg-muted" />
                <div className="h-1.5 w-4/5 rounded-full bg-muted" />
              </div>
            </div>
            <div className="absolute top-16 right-20 h-32 w-44 rounded-2xl bg-primary text-white shadow-xl rotate-[-2deg] p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Receipt className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="text-[11px] font-semibold">factures.csv</p>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-white/30" />
                <div className="h-1.5 w-3/4 rounded-full bg-white/30" />
                <div className="h-1.5 w-5/6 rounded-full bg-white/30" />
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-wide opacity-80">
                  Importé
                </span>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Source picker grid (each tile is the CTA) ─────────────────────── */}
      <div className="rounded-2xl border border-border bg-white p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Choisissez votre logiciel actuel
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Cliquez sur le logiciel depuis lequel vous voulez transférer vos données.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700 self-start sm:self-end">
            <CheckCircle2 className="h-3 w-3" />
            12 logiciels compatibles
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SUPPORTED_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onLaunch(s.id)}
              className={`group relative rounded-2xl border border-border bg-white p-4 flex flex-col items-center text-center gap-2.5 transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 hover:ring-4 ${s.ring}/20 focus:outline-none focus:ring-4 focus:ring-primary/20`}
            >
              {s.badge && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center h-4 px-2 rounded-full bg-primary text-[8px] font-bold uppercase tracking-wide text-primary-foreground whitespace-nowrap shadow-sm">
                  {s.badge}
                </span>
              )}
              <div
                className={`h-14 w-14 rounded-2xl ${s.bg} ${s.fg} flex items-center justify-center text-lg font-bold flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform`}
              >
                {s.wordmark}
              </div>
              <div className="min-w-0 w-full">
                <p className="text-sm font-semibold text-foreground truncate">
                  {s.name}
                </p>
                {s.caption && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {s.caption}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>

        <p className="mt-5 text-[11px] text-muted-foreground text-center">
          Votre logiciel n&apos;est pas dans la liste ? Cliquez sur{' '}
          <button
            type="button"
            onClick={() => onLaunch('excel')}
            className="font-semibold text-primary hover:underline"
          >
            Excel
          </button>{' '}
          — n&apos;importe quel export CSV fonctionne.
        </p>
      </div>

      {/* ── Perks (3 columns) ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PERKS.map((perk) => {
          const Icon = perk.icon;
          return (
            <div
              key={perk.title}
              className="rounded-2xl border border-border bg-white p-4 flex items-start gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{perk.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {perk.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Entities transferred ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-white p-5 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
          Ce qui sera transféré
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Hellobat reconstitue automatiquement les liens entre vos données.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {ENTITIES.map((entity) => {
            const Icon = entity.icon;
            return (
              <div
                key={entity.title}
                className="rounded-xl border border-border bg-white p-3 flex items-start gap-3"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {entity.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {entity.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
