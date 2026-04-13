'use client';

import { useState } from 'react';
import { LandingMap } from './landing-map';
import {
  Euro,
  FileText,
  Receipt,
  HardHat,
  CalendarDays,
  MapPin,
  UsersRound,
  BookOpen,
  Globe,
  Target,
  Mail,
  Star,
  Paintbrush,
  CreditCard,
  RefreshCw,
  Bot,
  Calculator,
  Calendar,
  Package,
  CheckCircle2,
  BarChart3,
  PenLine,
  ScanLine,
  Landmark,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Check,
  Camera,
  Wand2,
  Mic,
  Wrench,
  Scale,
  Leaf,
  Flame,
  Wind,
  Waves,
  Folder,
  FolderOpen,
  FileImage,
  File as FileIcon,
  ExternalLink,
  TrendingUp,
  Hexagon,
  Zap,
  ChevronDown,
  X,
  Send,
  Loader2,
} from 'lucide-react';
import { ResponsiveContainer, Area, AreaChart, Bar, BarChart } from 'recharts';

/* ════════════════════════════════════════════════════════════════════
   Nav structure — mirror of components/sidebar/sidebar-nav.tsx:26-79
   ════════════════════════════════════════════════════════════════════ */

type NavItem = { id: string; label: string; emoji: string };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', emoji: '📊' },
      { id: 'calendrier', label: 'Calendrier', emoji: '📅' },
      { id: 'taches', label: 'Mes tâches', emoji: '✅' },
      { id: 'contacts', label: 'Contacts', emoji: '👤' },
      { id: 'devis', label: 'Devis', emoji: '📝' },
      { id: 'factures', label: 'Factures', emoji: '🧾' },
      { id: 'prestations', label: 'Mes prestations', emoji: '🛠️' },
      { id: 'documents', label: 'Mes documents', emoji: '📁' },
      { id: 'hellopay', label: 'HelloPay', emoji: '⚡' },
    ],
  },
  {
    title: 'Chantiers',
    items: [
      { id: 'chantiers', label: 'Mes chantiers', emoji: '🏗️' },
      { id: 'planning', label: 'Planning', emoji: '🗓️' },
      { id: 'carte', label: 'Carte', emoji: '🗺️' },
      { id: 'equipe', label: 'Équipe', emoji: '👷' },
    ],
  },
  {
    title: 'Commercial',
    items: [
      { id: 'catalogues', label: 'Catalogues', emoji: '📚' },
      { id: 'prospection', label: 'Prospection', emoji: '🎯' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { id: 'mail', label: 'Boîte mail', emoji: '📧' },
      { id: 'avis', label: 'Avis Google', emoji: '⭐' },
    ],
  },
  {
    title: 'IA',
    items: [
      { id: 'agents', label: 'Agents IA', emoji: '🤖' },
      { id: 'rendus', label: 'Avant/Après IA', emoji: '🎨' },
      { id: 'site-web', label: 'Site web IA', emoji: '🌐' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { id: 'paiements', label: 'Paiement Stripe', emoji: '💳' },
      { id: 'contrats', label: 'Contrats récurrents', emoji: '🔄' },
      { id: 'comptabilite', label: 'Comptabilité IA', emoji: '🧮' },
    ],
  },
];

const flatItems: NavItem[] = navGroups.flatMap((g) => g.items);

// Favoris: pre-starred shortcuts surfaced at the top of the sidebar. Mirrors
// the real favoriteItems pseudo-group (sidebar-nav.tsx:225), which is
// independent from the single-open accordion — it can stay expanded while
// another group is also open. Hardcoded in the demo because there's no user
// state to persist here.
const favoriteItems: NavItem[] = [
  { id: 'carte', label: 'Carte', emoji: '🗺️' },
  { id: 'mail', label: 'Boîte mail', emoji: '📧' },
  { id: 'site-web', label: 'Site web IA', emoji: '🌐' },
  { id: 'comptabilite', label: 'Comptabilité IA', emoji: '🧮' },
];

/* ════════════════════════════════════════════════════════════════════
   Main component — shell (browser chrome + sidebar + content)
   ════════════════════════════════════════════════════════════════════ */

export function DemoApp() {
  const [active, setActive] = useState<string>('dashboard');
  // Accordion: a single group is open at a time. Mirrors the real sidebar
  // (components/sidebar/sidebar-nav.tsx:139) where "Principal" is the default
  // open group. `null` would mean everything collapsed.
  const [openGroup, setOpenGroup] = useState<string>('Principal');
  // Favoris is independent from the accordion — it can stay open alongside
  // the currently-open group. Default open on every load.
  const [favOpen, setFavOpen] = useState<boolean>(true);

  function selectItem(groupTitle: string, itemId: string) {
    setActive(itemId);
    // Keep the clicked item's group visibly open so the active row never
    // disappears under a collapsed header.
    setOpenGroup(groupTitle);
  }

  return (
    <section id="demo" className="py-12 sm:py-24 bg-[var(--landing-white)]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
            Explorez <em className="italic text-[var(--landing-accent)]">l&apos;application</em>
          </h2>
          <p className="text-[var(--landing-muted)] text-lg max-w-xl mx-auto">
            Ce que vous verrez après inscription. Mêmes écrans, mêmes couleurs, mêmes modules — explorez
            chaque vue avant même de créer votre compte.
          </p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-[var(--landing-border)] bg-white shadow-2xl shadow-black/5 overflow-hidden">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 border-b border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[10px] sm:text-xs text-[var(--landing-muted)] ml-2 sm:ml-3 font-mono">
              hellobat.app
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Google connecté
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:min-h-[560px]">
            {/* Desktop sidebar — mirrors real sidebar-nav with groups + emojis */}
            <aside className="w-[220px] shrink-0 border-r border-[var(--landing-border)] bg-[var(--landing-off)] p-3 hidden md:block overflow-y-auto max-h-[560px]">
              <div className="flex items-center gap-2 px-3 py-2 mb-3">
                <div className="w-6 h-6 bg-[var(--landing-accent)] rounded-md flex items-center justify-center">
                  <Hexagon className="h-3 w-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-[var(--landing-text)]">Hellobat</span>
              </div>

              <div className="space-y-3">
                {/* Favoris — independent group, default open. Clicking an
                    item here doesn't close the main accordion. */}
                <div>
                  <button
                    type="button"
                    onClick={() => setFavOpen((prev) => !prev)}
                    aria-expanded={favOpen}
                    className="w-full px-3 mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-amber-600/90 hover:text-amber-700 transition-colors group/group"
                  >
                    <span className="flex items-center gap-1 group-hover/group:translate-x-0.5 transition-transform duration-200">
                      <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                      Favoris
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-300 ease-out ${
                        favOpen ? '' : '-rotate-90'
                      }`}
                    />
                  </button>
                  {favOpen && (
                    <ul className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      {favoriteItems.map((item) => {
                        const isActive = active === item.id;
                        return (
                          <li key={`fav-${item.id}`} className="relative">
                            <button
                              type="button"
                              onClick={() => setActive(item.id)}
                              className={`w-full flex items-center gap-2 pl-2.5 pr-7 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left ${
                                isActive
                                  ? 'bg-white text-[var(--landing-text)] shadow-sm'
                                  : 'text-[var(--landing-muted)] hover:bg-white/60 hover:text-[var(--landing-text)]'
                              }`}
                            >
                              <span className="text-[13px] leading-none select-none">
                                {item.emoji}
                              </span>
                              <span className="truncate flex-1">{item.label}</span>
                            </button>
                            <Star className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 fill-amber-500 text-amber-500 pointer-events-none" />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {navGroups.map((group) => {
                  const isOpen = openGroup === group.title;
                  return (
                    <div key={group.title}>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenGroup((prev) => (prev === group.title ? '' : group.title))
                        }
                        aria-expanded={isOpen}
                        className="w-full px-3 mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]/80 hover:text-[var(--landing-text)] transition-colors group/group"
                      >
                        <span className="group-hover/group:translate-x-0.5 transition-transform duration-200">
                          {group.title}
                        </span>
                        <ChevronDown
                          className={`h-3 w-3 transition-transform duration-300 ease-out ${
                            isOpen ? '' : '-rotate-90'
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <ul className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                          {group.items.map((item) => {
                            const isActive = active === item.id;
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => selectItem(group.title, item.id)}
                                  className={`w-full flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left ${
                                    isActive
                                      ? 'bg-white text-[var(--landing-text)] shadow-sm'
                                      : 'text-[var(--landing-muted)] hover:bg-white/60 hover:text-[var(--landing-text)]'
                                  }`}
                                >
                                  <span className="text-[13px] leading-none select-none">{item.emoji}</span>
                                  <span className="truncate flex-1">{item.label}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Mobile tabs — flat list of all views, horizontally scrollable */}
            <div className="md:hidden px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-off)] overflow-x-auto">
              <div className="flex gap-1 w-max">
                {flatItems.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setActive(v.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
                      active === v.id
                        ? 'bg-[var(--landing-accent)] text-white'
                        : 'bg-white text-[var(--landing-muted)] border border-[var(--landing-border)]'
                    }`}
                  >
                    <span>{v.emoji}</span>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-4 md:p-6 overflow-x-auto min-h-[400px]">
              <DemoViewContent view={active} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Dispatcher
   ════════════════════════════════════════════════════════════════════ */

export function DemoViewContent({ view }: { view: string }) {
  switch (view) {
    case 'dashboard':
      return <DashboardView />;
    case 'calendrier':
      return <CalendrierView />;
    case 'taches':
      return <TachesView />;
    case 'contacts':
      return <ContactsView />;
    case 'devis':
      return <DevisView />;
    case 'factures':
      return <FacturesView />;
    case 'prestations':
      return <PrestationsView />;
    case 'documents':
      return <DocumentsView />;
    case 'chantiers':
      return <ChantiersView />;
    case 'planning':
      return <PlanningView />;
    case 'carte':
      return <CarteView />;
    case 'equipe':
      return <EquipeView />;
    case 'catalogues':
      return <CataloguesView />;
    case 'prospection':
      return <ProspectionView />;
    case 'mail':
      return <EmailsView />;
    case 'avis':
      return <AvisView />;
    case 'agents':
      return <AgentsView />;
    case 'rendus':
      return <RendusView />;
    case 'site-web':
      return <SiteWebView />;
    case 'hellopay':
      return <HelloPayView />;
    case 'paiements':
      return <PaiementView />;
    case 'contrats':
      return <ContratsView />;
    case 'comptabilite':
      return <ComptaView />;
    default:
      return null;
  }
}

/* ════════════════════════════════════════════════════════════════════
   Primitives — mirror the real design system
   ════════════════════════════════════════════════════════════════════ */

function LandingPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6">
      <div>
        <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--landing-text)]">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs text-[var(--landing-muted)]">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}
    >
      {label}
    </span>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  sparkline,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend?: { value: string; positive: boolean };
  icon: React.ElementType;
  sparkline?: { value: number }[];
}) {
  return (
    <div className="relative rounded-xl border border-[var(--landing-border)] bg-white p-4 overflow-hidden">
      {sparkline && sparkline.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 h-[60%] opacity-[0.08] pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--landing-accent)"
                fill="var(--landing-accent)"
                fillOpacity={0.5}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-medium text-[var(--landing-muted)] uppercase tracking-wide">
            {title}
          </p>
          <p className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--landing-text)]">
            {value}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[10px] text-[var(--landing-muted)]">{subtitle}</p>
            {trend && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                  trend.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                <TrendingUp className={`w-2.5 h-2.5 ${trend.positive ? '' : 'rotate-180'}`} />
                {trend.value}
              </span>
            )}
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] shrink-0">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   1. DASHBOARD — date presets + 4 KPI cards (sparklines) + AreaChart + funnel
   ════════════════════════════════════════════════════════════════════ */

const dashSparkCA = [
  { value: 18 }, { value: 22 }, { value: 25 }, { value: 28 },
  { value: 26 }, { value: 32 }, { value: 35 }, { value: 31 },
  { value: 36 }, { value: 40 }, { value: 38 }, { value: 42 },
];
const dashSparkDevis = [
  { value: 3 }, { value: 4 }, { value: 5 }, { value: 4 },
  { value: 6 }, { value: 7 }, { value: 6 }, { value: 8 },
  { value: 9 }, { value: 9 }, { value: 10 }, { value: 12 },
];
const dashSparkChantiers = [
  { value: 1 }, { value: 2 }, { value: 2 }, { value: 3 },
  { value: 3 }, { value: 4 }, { value: 3 }, { value: 4 },
  { value: 5 }, { value: 4 }, { value: 5 }, { value: 4 },
];
const dashSparkMrr = [
  { value: 2200 }, { value: 2200 }, { value: 2600 }, { value: 2600 },
  { value: 3100 }, { value: 3100 }, { value: 3500 }, { value: 3500 },
  { value: 3800 }, { value: 3800 }, { value: 4200 }, { value: 4200 },
];

const dashRevenueData = [
  { m: 'Jan', ca: 22, fac: 26, dev: 31 },
  { m: 'Fév', ca: 27, fac: 30, dev: 34 },
  { m: 'Mar', ca: 31, fac: 33, dev: 36 },
  { m: 'Avr', ca: 28, fac: 32, dev: 38 },
  { m: 'Mai', ca: 34, fac: 38, dev: 42 },
  { m: 'Juin', ca: 29, fac: 34, dev: 40 },
  { m: 'Juil', ca: 33, fac: 37, dev: 44 },
  { m: 'Aoû', ca: 36, fac: 40, dev: 46 },
  { m: 'Sep', ca: 32, fac: 36, dev: 42 },
  { m: 'Oct', ca: 38, fac: 42, dev: 48 },
  { m: 'Nov', ca: 35, fac: 40, dev: 44 },
  { m: 'Déc', ca: 38, fac: 43, dev: 50 },
];

function DashboardView() {
  const presets = ['Jour', 'Semaine', 'Mois', 'Année'];
  const activePreset = 'Année';

  const funnel = [
    { stage: 'Nouveau', count: 45 },
    { stage: 'Contacté', count: 32 },
    { stage: 'Devis', count: 18 },
    { stage: 'Gagné', count: 9 },
  ];
  const funnelMax = 45;

  return (
    <div>
      <LandingPageHeader title="Tableau de bord" description="Vue d'ensemble de votre activité">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--landing-border)] bg-white p-0.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                p === activePreset
                  ? 'bg-[var(--landing-accent)] text-white'
                  : 'text-[var(--landing-muted)] hover:text-[var(--landing-text)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </LandingPageHeader>

      {/* KPI cards with real sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="CA encaissé"
          value="38 400 €"
          subtitle="vs. année dernière"
          trend={{ value: '+18%', positive: true }}
          icon={Euro}
          sparkline={dashSparkCA}
        />
        <KpiCard
          title="Devis signés"
          value="9 / 12"
          subtitle="taux 75%"
          trend={{ value: '+4', positive: true }}
          icon={FileText}
          sparkline={dashSparkDevis}
        />
        <KpiCard
          title="Chantiers en cours"
          value="4"
          subtitle="2 prévus ce mois"
          icon={HardHat}
          sparkline={dashSparkChantiers}
        />
        <KpiCard
          title="MRR contrats"
          value="4 200 €"
          subtitle="12 contrats actifs"
          trend={{ value: '+8%', positive: true }}
          icon={RefreshCw}
          sparkline={dashSparkMrr}
        />
      </div>

      {/* Revenue chart + Lead funnel */}
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-[var(--landing-border)] bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-[var(--landing-text)]">
                Évolution du chiffre d&apos;affaires
              </p>
              <p className="text-[10px] text-[var(--landing-muted)]">
                CA encaissé · Factures créées · Devis créés
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="h-[130px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashRevenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--landing-accent)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--landing-accent)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradFac" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="dev"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  fill="transparent"
                />
                <Area
                  type="monotone"
                  dataKey="fac"
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                  fill="url(#gradFac)"
                />
                <Area
                  type="monotone"
                  dataKey="ca"
                  stroke="var(--landing-accent)"
                  strokeWidth={2}
                  fill="url(#gradCa)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-1">
            {dashRevenueData.map((d) => (
              <span key={d.m} className="text-[8px] text-[var(--landing-muted)] flex-1 text-center">
                {d.m}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[var(--landing-border)]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[var(--landing-accent)]" />
              <span className="text-[9px] text-[var(--landing-muted)]">CA encaissé</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#60a5fa]" />
              <span className="text-[9px] text-[var(--landing-muted)]">Factures créées</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#94a3b8]" />
              <span className="text-[9px] text-[var(--landing-muted)]">Devis créés</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--landing-border)] bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-[var(--landing-text)]">Funnel leads</p>
              <p className="text-[10px] text-[var(--landing-muted)]">Ce mois</p>
            </div>
            <Target className="w-4 h-4 text-[var(--landing-muted)]" />
          </div>
          <div className="space-y-2.5">
            {funnel.map((row, i) => (
              <div key={row.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-[var(--landing-text)]">
                    {row.stage}
                  </span>
                  <span className="text-[10px] font-semibold text-[var(--landing-text)] tabular-nums">
                    {row.count}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--landing-stone)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--landing-accent)] transition-all"
                    style={{
                      width: `${(row.count / funnelMax) * 100}%`,
                      opacity: 1 - i * 0.15,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--landing-border)] flex items-center justify-between">
            <span className="text-[10px] text-[var(--landing-muted)]">Taux de conversion</span>
            <span className="text-[11px] font-semibold text-emerald-700">20%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   2. CALENDRIER — week grid + Google Calendar synced badge
   ════════════════════════════════════════════════════════════════════ */

function CalendrierView() {
  const days = ['Lun 6', 'Mar 7', 'Mer 8', 'Jeu 9', 'Ven 10'];
  const events = [
    { day: 0, top: '12%', height: '22%', label: 'RDV M. Dupont', color: 'bg-blue-50 border-blue-200 text-blue-700', google: true },
    { day: 1, top: '20%', height: '30%', label: 'Chantier Bernard', color: 'bg-[var(--landing-accent)]/10 border-[var(--landing-accent)]/30 text-[var(--landing-accent)]', google: false },
    { day: 2, top: '5%', height: '18%', label: 'Réunion équipe', color: 'bg-purple-50 border-purple-200 text-purple-700', google: true },
    { day: 3, top: '42%', height: '25%', label: 'Visite technique', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', google: false },
    { day: 4, top: '15%', height: '22%', label: 'Devis Leroy', color: 'bg-amber-50 border-amber-200 text-amber-700', google: true },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Calendrier"
        description="Vos rendez-vous et événements synchronisés avec Google Calendar"
      >
        <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Google Calendar synchronisé
        </span>
      </LandingPageHeader>

      <div className="grid grid-cols-5 gap-1">
        {days.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-[var(--landing-muted)] uppercase tracking-wider pb-2"
          >
            {d}
          </div>
        ))}
        {days.map((d, i) => (
          <div
            key={d}
            className="relative h-[220px] border border-[var(--landing-border)] rounded-lg bg-[var(--landing-off)]"
          >
            {events
              .filter((e) => e.day === i)
              .map((ev) => (
                <div
                  key={ev.label}
                  className={`absolute left-1 right-1 rounded-md border p-1.5 ${ev.color}`}
                  style={{ top: ev.top, height: ev.height }}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-semibold truncate">{ev.label}</span>
                    {ev.google && <Calendar className="w-2.5 h-2.5 text-blue-500 shrink-0" />}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   3. TÂCHES
   ════════════════════════════════════════════════════════════════════ */

function TachesView() {
  const tasks = [
    { label: 'Relancer devis D-2026-042', done: false, due: 'Aujourd\u2019hui', prio: 'haute' as const, cat: 'Devis' },
    { label: 'Commander faïence chantier Dupont', done: false, due: 'Demain', prio: 'moyenne' as const, cat: 'Chantier' },
    { label: 'Envoyer facture Bernard', done: true, due: 'Hier', prio: 'haute' as const, cat: 'Facture' },
    { label: 'Vérifier photos chantier Martin', done: false, due: 'Cette semaine', prio: 'basse' as const, cat: 'Chantier' },
    { label: 'Préparer rendez-vous SCI Martin', done: false, due: 'Vendredi', prio: 'moyenne' as const, cat: 'Prospection' },
  ];
  const prioColor = {
    haute: 'bg-red-500',
    moyenne: 'bg-amber-500',
    basse: 'bg-slate-400',
  };
  const filters = ['Toutes', 'À faire', 'Terminées'];
  const activeFilter = 'Toutes';

  return (
    <div>
      <LandingPageHeader title="Mes tâches" description="Gérez vos tâches et priorités" />

      <div className="flex items-center gap-1 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${
              f === activeFilter
                ? 'bg-[var(--landing-accent)] text-white'
                : 'bg-white border border-[var(--landing-border)] text-[var(--landing-muted)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.label}
            className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] px-4 py-3"
          >
            <span className={`w-1 h-8 rounded-full ${prioColor[task.prio]}`} />
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                task.done
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-[var(--landing-border)] bg-white'
              }`}
            >
              {task.done && <Check className="h-3 w-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-xs font-medium ${
                  task.done ? 'text-[var(--landing-muted)] line-through' : 'text-[var(--landing-text)]'
                }`}
              >
                {task.label}
              </div>
              <div className="text-[10px] text-[var(--landing-muted)]">
                {task.cat} · {task.due}
              </div>
            </div>
            {task.done ? (
              <Badge label="Terminée" color="bg-emerald-50 text-emerald-700" />
            ) : (
              <Badge label="À faire" color="bg-amber-50 text-amber-700" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   4. CONTACTS
   ════════════════════════════════════════════════════════════════════ */

function ContactsView() {
  const contacts = [
    { name: 'Mme Bernard', type: 'Client', city: 'Lyon', color: 'bg-blue-50 text-blue-700', initial: 'B' },
    { name: 'SCI Martin', type: 'Prospect', city: 'Marseille', color: 'bg-amber-50 text-amber-700', initial: 'M' },
    { name: 'Fournisseur Pro', type: 'Prestataire', city: 'Paris', color: 'bg-purple-50 text-purple-700', initial: 'F' },
    { name: 'M. Dupont', type: 'Client', city: 'Paris', color: 'bg-blue-50 text-blue-700', initial: 'D' },
    { name: 'Mme Petit', type: 'Client', city: 'Bordeaux', color: 'bg-blue-50 text-blue-700', initial: 'P' },
    { name: 'Electro Sud', type: 'Prestataire', city: 'Nice', color: 'bg-purple-50 text-purple-700', initial: 'E' },
  ];
  const filters = ['Tous', 'Clients', 'Prospects', 'Prestataires'];

  return (
    <div>
      <LandingPageHeader title="Contacts" description="Clients, prospects et prestataires" />

      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {filters.map((f, i) => (
          <button
            key={f}
            type="button"
            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${
              i === 0
                ? 'bg-[var(--landing-accent)] text-white'
                : 'bg-white border border-[var(--landing-border)] text-[var(--landing-muted)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {contacts.map((contact) => (
          <div
            key={contact.name}
            className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] px-4 py-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] font-semibold text-xs">
              {contact.initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--landing-text)]">{contact.name}</div>
              <div className="text-[10px] text-[var(--landing-muted)]">{contact.city}</div>
            </div>
            <Badge label={contact.type} color={contact.color} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   5. DEVIS — Assistant IA card + pastel status table
   ════════════════════════════════════════════════════════════════════ */

function DevisView() {
  const devis = [
    { num: 'D-2026-042', client: 'M. Dupont', objet: 'Rénovation salle de bain', montant: '8 500 €', color: 'bg-blue-50 text-blue-700', status: 'Envoyé', recurring: false, signed: false },
    { num: 'D-2026-041', client: 'Mme Bernard', objet: 'Entretien chaudière annuel', montant: '420 €/mois', color: 'bg-emerald-50 text-emerald-700', status: 'Accepté', recurring: true, signed: true },
    { num: 'D-2026-040', client: 'SCI Martin', objet: 'Réfection toiture terrasse', montant: '15 800 €', color: 'bg-slate-100 text-slate-700', status: 'Brouillon', recurring: false, signed: false },
    { num: 'D-2026-039', client: 'M. Leroy', objet: 'Plomberie complète', montant: '6 300 €', color: 'bg-red-50 text-red-700', status: 'Refusé', recurring: false, signed: false },
    { num: 'D-2026-038', client: 'Mme Petit', objet: 'Maintenance clim trim.', montant: '350 €/trim.', color: 'bg-emerald-50 text-emerald-700', status: 'Accepté', recurring: true, signed: true },
  ];

  // Preloaded voice transcript + photos to simulate a visit where the user
  // has already dictated and uploaded photos. Clicking "Générer" just walks
  // through the IA states — no actual API call.
  const transcript =
    "Rénovation complète salle de bain chez Monsieur Dupont au 14 rue des Tilleuls à Lyon 7e. Surface 6 m². Dépose de l'ancien carrelage sol et mur, faïence murale jusqu'à 1m80, nouveau receveur douche extra-plat 90x90, meuble vasque 80 cm avec miroir LED, robinetterie thermostatique Grohe, sèche-serviettes électrique 500 W. Reprise complète de l'étanchéité sol et mur. Livraison matériaux à prévoir, démarrage lundi 13 avril.";

  const generatedLines = [
    { label: 'Dépose carrelage sol + faïence murale existante', qty: '1 f', price: '450,00' },
    { label: 'Fourniture + pose carrelage sol 60×60 gris anthracite', qty: '6 m²', price: '540,00' },
    { label: 'Fourniture + pose faïence murale blanche mate', qty: '12 m²', price: '780,00' },
    { label: 'Receveur douche extra-plat 90×90 + bonde', qty: '1 u', price: '380,00' },
    { label: 'Meuble vasque 80 cm avec miroir LED intégré', qty: '1 u', price: '620,00' },
    { label: 'Mitigeur thermostatique Grohe + colonne douche', qty: '1 u', price: '290,00' },
    { label: 'Sèche-serviettes électrique 500 W', qty: '1 u', price: '320,00' },
    { label: 'Reprise étanchéité sol et mur (SEL + SPEC)', qty: '1 f', price: '680,00' },
    { label: "Main d'œuvre, évacuation gravats, nettoyage", qty: '1 f', price: '1 440,00' },
  ];

  const [quoteState, setQuoteState] = useState<'idle' | 'generating' | 'generated'>('idle');

  function generateQuote() {
    setQuoteState('generating');
    // Simulate ~1.8s of "Claude is analyzing" then reveal the generated card.
    // The lines above are hardcoded — this is a pure visual simulation.
    setTimeout(() => setQuoteState('generated'), 1800);
  }
  function resetQuote() {
    setQuoteState('idle');
  }

  return (
    <div>
      <LandingPageHeader title="Devis" description="Créez, gérez et envoyez vos devis" />

      {/* Assistant IA card — preloaded transcript + photos + Generate */}
      <div className="relative rounded-xl border border-dashed border-[var(--landing-accent)]/40 bg-gradient-to-br from-[var(--landing-accent)]/5 via-transparent to-transparent p-4 mb-4 overflow-hidden">
        <div className="flex items-start gap-3 mb-3">
          <div className="relative shrink-0">
            {quoteState !== 'generating' && (
              <div className="absolute inset-0 rounded-full bg-[var(--landing-accent)]/30 animate-ping" />
            )}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--landing-accent)] text-white shadow-lg">
              {quoteState === 'generating' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-xs font-semibold text-[var(--landing-text)]">
                Assistant devis IA
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[#D97706]/10 text-[#D97706] font-semibold">
                <Sparkles className="w-2.5 h-2.5" /> Claude Sonnet
              </span>
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-2.5 h-2.5" /> Transcription prête
              </span>
            </div>
            <p className="text-[11px] text-[var(--landing-muted)]">
              Vos notes vocales et photos ont été analysées. Cliquez pour générer le devis.
            </p>
          </div>
        </div>

        {/* Voice transcript preview */}
        <div className="rounded-lg bg-white border border-[var(--landing-border)] p-3 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Mic className="w-3 h-3 text-[var(--landing-accent)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
              Transcript vocal · 42 secondes
            </span>
          </div>
          <div className="flex items-end gap-[2px] h-4 mb-2">
            {Array.from({ length: 40 }).map((_, i) => {
              const h = Math.abs(Math.sin(i * 0.5) * Math.cos(i * 0.3)) * 80 + 15;
              return (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-[var(--landing-accent)]/40"
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--landing-text)] leading-relaxed italic">
            « {transcript} »
          </p>
        </div>

        {/* Photo thumbnails */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--landing-muted)] mr-1">
            Photos jointes
          </span>
          {[
            { from: 'from-slate-300', to: 'to-slate-500', label: 'Salle de bain' },
            { from: 'from-stone-300', to: 'to-stone-500', label: 'Mur douche' },
            { from: 'from-zinc-300', to: 'to-zinc-500', label: 'Sol actuel' },
          ].map((ph, i) => (
            <div
              key={i}
              className={`relative w-14 h-14 rounded-lg bg-gradient-to-br ${ph.from} ${ph.to} border border-[var(--landing-border)] flex items-center justify-center overflow-hidden`}
            >
              <Camera className="w-4 h-4 text-white/80" />
              <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[7px] text-center py-0.5 truncate px-0.5">
                {ph.label}
              </span>
            </div>
          ))}
          <span className="text-[10px] text-[var(--landing-muted)]">3 photos</span>
        </div>

        {/* Action button — switches text/state based on quoteState */}
        {quoteState === 'idle' && (
          <button
            type="button"
            onClick={generateQuote}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--landing-accent)] text-white px-3.5 py-2 text-[11px] font-semibold shadow-sm hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-3 h-3" />
            Générer le devis avec Claude
          </button>
        )}
        {quoteState === 'generating' && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] px-3.5 py-2 text-[11px] font-semibold">
            <Loader2 className="w-3 h-3 animate-spin" />
            Claude analyse votre chantier…
          </div>
        )}
        {quoteState === 'generated' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 text-[11px] font-semibold">
              <CheckCircle2 className="w-3 h-3" />
              Devis généré en 6,8 secondes
            </span>
            <button
              type="button"
              onClick={resetQuote}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--landing-border)] bg-white text-[var(--landing-muted)] px-2.5 py-1.5 text-[10px] font-semibold hover:bg-[var(--landing-off)] transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Recommencer
            </button>
          </div>
        )}
      </div>

      {/* Generated quote preview — only shown after generation */}
      {quoteState === 'generated' && (
        <div className="mb-4 rounded-xl border border-[var(--landing-accent)]/30 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="bg-gradient-to-r from-[var(--landing-accent)]/10 to-transparent px-4 py-3 border-b border-[var(--landing-border)] flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="text-[10px] font-mono text-[var(--landing-accent)] font-bold">
                  D-2026-043
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] font-bold">
                  <Sparkles className="w-2.5 h-2.5" /> Rédigé par Claude
                </span>
              </div>
              <div className="text-xs font-semibold text-[var(--landing-text)]">
                M. Jean Dupont · Rénovation salle de bain
              </div>
              <div className="text-[10px] text-[var(--landing-muted)]">
                14 rue des Tilleuls, 69007 Lyon · Surface 6 m²
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] text-[var(--landing-muted)] uppercase tracking-wide">
                Total TTC
              </div>
              <div className="text-base font-bold text-[var(--landing-text)]">6 050,00 €</div>
            </div>
          </div>
          <div className="divide-y divide-[var(--landing-border)]">
            {generatedLines.map((line, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-4 py-2 text-[11px] hover:bg-[var(--landing-off)]/40 transition-colors"
              >
                <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                <span className="flex-1 text-[var(--landing-text)]">{line.label}</span>
                <span className="text-[var(--landing-muted)] w-12 text-right shrink-0">
                  {line.qty}
                </span>
                <span className="font-semibold text-[var(--landing-text)] w-16 text-right shrink-0">
                  {line.price} €
                </span>
              </div>
            ))}
          </div>
          <div className="bg-[var(--landing-off)] px-4 py-3 space-y-1">
            <div className="flex justify-between text-[11px] text-[var(--landing-muted)]">
              <span>Sous-total HT</span>
              <span className="font-semibold text-[var(--landing-text)]">5 500,00 €</span>
            </div>
            <div className="flex justify-between text-[11px] text-[var(--landing-muted)]">
              <span>TVA 10 % (rénovation)</span>
              <span className="font-semibold text-[var(--landing-text)]">550,00 €</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-[var(--landing-border)]">
              <span className="font-bold text-[var(--landing-text)]">Total TTC</span>
              <span className="font-bold text-[var(--landing-accent)]">6 050,00 €</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-[var(--landing-border)] bg-white">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--landing-border)] bg-white text-[var(--landing-text)] px-2.5 py-1.5 text-[10px] font-semibold hover:bg-[var(--landing-off)] transition-colors"
            >
              <PenLine className="w-2.5 h-2.5" />
              Modifier
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--landing-accent)] text-white px-3 py-1.5 text-[10px] font-semibold shadow-sm hover:opacity-90 transition-opacity"
            >
              <Send className="w-2.5 h-2.5" />
              Envoyer au client
            </button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden sm:block border border-[var(--landing-border)] rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--landing-off)] text-[10px] font-medium text-[var(--landing-muted)] uppercase tracking-wider">
              <th className="px-4 py-3">Numéro</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3 hidden md:table-cell">Objet</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {devis.map((d) => (
              <tr
                key={d.num}
                className="border-t border-[var(--landing-border)] hover:bg-[var(--landing-off)]/50 transition-colors"
              >
                <td className="px-4 py-3 text-xs font-mono text-[var(--landing-accent)]">{d.num}</td>
                <td className="px-4 py-3 text-xs font-medium text-[var(--landing-text)]">
                  <div className="flex items-center gap-1.5">
                    {d.client}
                    {d.recurring && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        <RefreshCw className="w-2 h-2" /> Contrat
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--landing-muted)] hidden md:table-cell">
                  {d.objet}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-[var(--landing-text)] text-right">
                  {d.montant}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Badge label={d.status} color={d.color} />
                    {d.signed && <PenLine className="w-3 h-3 text-emerald-600" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {devis.map((d) => (
          <div
            key={d.num}
            className="p-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)]"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[var(--landing-accent)]">{d.num}</span>
                {d.recurring && (
                  <span className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    <RefreshCw className="w-2 h-2" /> Contrat
                  </span>
                )}
                {d.signed && <PenLine className="w-3 h-3 text-emerald-600" />}
              </div>
              <Badge label={d.status} color={d.color} />
            </div>
            <div className="text-xs font-medium text-[var(--landing-text)]">{d.client}</div>
            <div className="text-[10px] text-[var(--landing-muted)]">{d.objet}</div>
            <div className="text-xs font-semibold text-[var(--landing-text)] mt-1">{d.montant}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   6. FACTURES
   ════════════════════════════════════════════════════════════════════ */

function FacturesView() {
  const invoices = [
    { num: 'F-2026-018', client: 'Mme Bernard', montant: '4 200 €', color: 'bg-blue-50 text-blue-700', status: 'Envoyée', source: null },
    { num: 'F-2026-017', client: 'M. Dupont', montant: '8 500 €', color: 'bg-emerald-50 text-emerald-700', status: 'Payée', source: null },
    { num: 'F-2026-016', client: 'SCI Martin', montant: '15 800 €', color: 'bg-red-50 text-red-700', status: 'En retard', source: null },
    { num: 'F-2026-015', client: 'M. Dupont', montant: '420 €', color: 'bg-emerald-50 text-emerald-700', status: 'Payée', source: 'contrat' },
    { num: 'F-2026-014', client: 'Mme Petit', montant: '350 €', color: 'bg-blue-50 text-blue-700', status: 'Envoyée', source: 'contrat' },
  ];

  return (
    <div>
      <LandingPageHeader title="Factures" description="Gérez vos factures et encaissements" />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl border border-[var(--landing-border)] bg-white">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium uppercase tracking-wide">
            Total 2026
          </div>
          <div className="text-base sm:text-lg font-bold text-[var(--landing-text)] mt-1">
            142 800 €
          </div>
        </div>
        <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50">
          <div className="text-[10px] text-blue-700 font-medium uppercase tracking-wide">
            En attente
          </div>
          <div className="text-base sm:text-lg font-bold text-blue-800 mt-1">18 400 €</div>
        </div>
        <div className="p-3 rounded-xl border border-red-200 bg-red-50/50">
          <div className="text-[10px] text-red-700 font-medium uppercase tracking-wide">
            En retard
          </div>
          <div className="text-base sm:text-lg font-bold text-red-800 mt-1">6 300 €</div>
        </div>
      </div>

      <div className="space-y-2">
        {invoices.map((invoice) => (
          <div
            key={invoice.num}
            className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] px-4 py-3"
          >
            <div className="min-w-[84px] text-[10px] font-mono text-[var(--landing-accent)]">
              {invoice.num}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--landing-text)] truncate">
                  {invoice.client}
                </span>
                {invoice.source === 'contrat' && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                    <RefreshCw className="w-2 h-2" /> Contrat
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[var(--landing-muted)]">{invoice.montant}</div>
            </div>
            <Badge label={invoice.status} color={invoice.color} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   7. PRESTATIONS
   ════════════════════════════════════════════════════════════════════ */

function PrestationsView() {
  const services = [
    { name: 'Dépose carrelage', unit: 'm²', price: '35 €', cat: 'Démolition', recurring: false },
    { name: 'Pose faïence murale', unit: 'm²', price: '55 €', cat: 'Carrelage', recurring: false },
    { name: 'Entretien chaudière gaz', unit: 'unité', price: '180 €', cat: 'Maintenance', recurring: true, freq: '/an' },
    { name: 'Maintenance climatisation', unit: 'unité', price: '120 €', cat: 'Maintenance', recurring: true, freq: '/trim.' },
    { name: 'Remplacement robinetterie', unit: 'unité', price: '95 €', cat: 'Plomberie', recurring: false },
    { name: 'Entretien piscine', unit: 'unité', price: '250 €', cat: 'Maintenance', recurring: true, freq: '/mois' },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Mes prestations"
        description="Votre bibliothèque de services et tarifs"
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl border border-[var(--landing-border)] bg-white">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium uppercase tracking-wide">
            Total
          </div>
          <div className="text-lg font-bold text-[var(--landing-text)] mt-1">24</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--landing-border)] bg-white">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium uppercase tracking-wide">
            Catégories
          </div>
          <div className="text-lg font-bold text-[var(--landing-text)] mt-1">6</div>
        </div>
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <div className="text-[10px] text-emerald-700 font-medium uppercase tracking-wide">
            Récurrentes
          </div>
          <div className="text-lg font-bold text-emerald-800 mt-1">3</div>
        </div>
      </div>

      <div className="space-y-2">
        {services.map((s) => (
          <div
            key={s.name}
            className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] px-4 py-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-accent)]/10">
              <Package className="h-4 w-4 text-[var(--landing-accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-[var(--landing-text)] truncate">
                  {s.name}
                </span>
                {s.recurring && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                    <RefreshCw className="w-2 h-2" /> {s.freq}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--landing-muted)]">{s.cat}</span>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-semibold text-[var(--landing-text)]">{s.price}</div>
              <div className="text-[10px] text-[var(--landing-muted)]">/ {s.unit}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   8. DOCUMENTS — NEW VIEW
   ════════════════════════════════════════════════════════════════════ */

function DocumentsView() {
  const folders = [
    { name: 'Devis', icon: FileText, count: 42, active: true },
    { name: 'Factures', icon: Receipt, count: 28, active: false },
    { name: 'Photos chantiers', icon: Camera, count: 156, active: false },
    { name: 'Contrats', icon: RefreshCw, count: 12, active: false },
  ];
  const files = [
    { name: 'D-2026-042 - Dupont SdB.pdf', type: 'pdf', size: '248 Ko', date: 'Aujourd\u2019hui' },
    { name: 'D-2026-041 - Bernard entretien.pdf', type: 'pdf', size: '192 Ko', date: 'Hier' },
    { name: 'D-2026-040 - Martin toiture.pdf', type: 'pdf', size: '312 Ko', date: '2 avr.' },
    { name: 'D-2026-039 - Leroy plomberie.pdf', type: 'pdf', size: '216 Ko', date: '1 avr.' },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Mes documents"
        description="Tous vos fichiers — devis, factures, photos chantiers, contrats"
      />

      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        {/* Folder tree */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-2 space-y-0.5 h-fit">
          {folders.map((f) => {
            const Icon = f.active ? FolderOpen : Folder;
            return (
              <button
                key={f.name}
                type="button"
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-left ${
                  f.active
                    ? 'bg-white text-[var(--landing-text)] shadow-sm'
                    : 'text-[var(--landing-muted)] hover:bg-white/60'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${f.active ? 'text-[var(--landing-accent)]' : ''}`}
                />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-[9px] text-[var(--landing-muted)]">{f.count}</span>
              </button>
            );
          })}
        </div>

        {/* File grid */}
        <div className="grid grid-cols-2 gap-2">
          {files.map((f) => (
            <div
              key={f.name}
              className="p-3 rounded-xl border border-[var(--landing-border)] bg-white hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center">
                  <FileIcon className="w-3.5 h-3.5 text-red-600" />
                </div>
                <span className="text-[9px] text-[var(--landing-muted)] uppercase font-semibold">
                  {f.type}
                </span>
              </div>
              <div className="text-[11px] font-medium text-[var(--landing-text)] truncate">
                {f.name}
              </div>
              <div className="text-[9px] text-[var(--landing-muted)] mt-0.5">
                {f.size} · {f.date}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   9. CHANTIERS — cards with photo placeholder + phase checklist
   ════════════════════════════════════════════════════════════════════ */

function ChantiersView() {
  const phasesFull = [
    'Devis signé',
    'Acompte payé',
    'Démarrage',
    'Avancement 50%',
    'Travaux terminés',
    'Solde payé',
  ];

  const chantiers = [
    {
      name: 'Rénovation Dupont',
      address: '12 rue des Lilas, Paris',
      progress: 75,
      status: 'En cours',
      color: 'bg-blue-50 text-blue-700',
      phases: 4,
    },
    {
      name: 'Clim Bernard',
      address: '8 av. de la Gare, Lyon',
      progress: 30,
      status: 'En cours',
      color: 'bg-blue-50 text-blue-700',
      phases: 2,
    },
    {
      name: 'Toiture Martin',
      address: '45 bd Pasteur, Marseille',
      progress: 0,
      status: 'À planifier',
      color: 'bg-slate-100 text-slate-700',
      phases: 0,
    },
    {
      name: 'Plomberie Leroy',
      address: '3 rue Victor Hugo, Lille',
      progress: 100,
      status: 'Terminé',
      color: 'bg-emerald-50 text-emerald-700',
      phases: 6,
    },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Mes chantiers"
        description="Suivez l'avancement de vos chantiers"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {chantiers.map((c) => (
          <div
            key={c.name}
            className="rounded-xl border border-[var(--landing-border)] bg-white overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Photo placeholder */}
            <div className="h-20 bg-gradient-to-br from-slate-200 via-slate-300 to-slate-200 relative flex items-center justify-center">
              <HardHat className="w-7 h-7 text-white/80" />
              <div className="absolute top-2 right-2">
                <Badge label={c.status} color={c.color} />
              </div>
            </div>

            <div className="p-3">
              <h4 className="text-xs font-semibold text-[var(--landing-text)]">{c.name}</h4>
              <p className="text-[10px] text-[var(--landing-muted)] flex items-center gap-1 mt-0.5">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                {c.address}
              </p>

              {/* Phase checklist */}
              <div className="mt-3 space-y-1">
                {phasesFull.slice(0, 4).map((phase, i) => {
                  const done = i < c.phases;
                  return (
                    <div key={phase} className="flex items-center gap-1.5">
                      <div
                        className={`w-3 h-3 rounded-full flex items-center justify-center shrink-0 ${
                          done ? 'bg-emerald-500' : 'bg-[var(--landing-stone)]'
                        }`}
                      >
                        {done && <Check className="w-2 h-2 text-white" />}
                      </div>
                      <span
                        className={`text-[9px] ${
                          done
                            ? 'text-[var(--landing-text)] font-medium'
                            : 'text-[var(--landing-muted)]'
                        }`}
                      >
                        {phase}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="mt-3 pt-2 border-t border-[var(--landing-border)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-[var(--landing-muted)]">Progression</span>
                  <span className="text-[10px] font-bold text-[var(--landing-text)]">
                    {c.progress}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--landing-stone)]">
                  <div
                    className="h-full rounded-full bg-[var(--landing-accent)] transition-all"
                    style={{ width: `${c.progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   10. PLANNING — team × days grid with colored event blocks
   ════════════════════════════════════════════════════════════════════ */

function PlanningView() {
  const members = [
    { name: 'Julien', role: 'Salarié', initials: 'JM', color: 'bg-blue-50 text-blue-700' },
    { name: 'Marc', role: 'Sous-traitant', initials: 'MR', color: 'bg-amber-50 text-amber-700' },
    { name: 'Thomas', role: 'Salarié', initials: 'TB', color: 'bg-blue-50 text-blue-700' },
    { name: 'Équipe 3', role: 'Sous-traitant', initials: 'E3', color: 'bg-amber-50 text-amber-700' },
  ];
  const days = ['Lun 6', 'Mar 7', 'Mer 8', 'Jeu 9', 'Ven 10'];

  const events: Record<string, { label: string; time: string; color: string }> = {
    '0-0': { label: 'Dupont SdB', time: '8h-12h', color: 'bg-[var(--landing-accent)]/15 text-[var(--landing-accent)] border-[var(--landing-accent)]/30' },
    '0-1': { label: 'Dupont SdB', time: '8h-17h', color: 'bg-[var(--landing-accent)]/15 text-[var(--landing-accent)] border-[var(--landing-accent)]/30' },
    '0-2': { label: 'Congé', time: 'Journée', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    '0-3': { label: 'Bernard clim', time: '9h-13h', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    '0-4': { label: 'Bernard clim', time: '9h-17h', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    '1-0': { label: 'Martin toiture', time: '8h-16h', color: 'bg-[var(--landing-accent)]/15 text-[var(--landing-accent)] border-[var(--landing-accent)]/30' },
    '1-1': { label: 'Martin toiture', time: '8h-16h', color: 'bg-[var(--landing-accent)]/15 text-[var(--landing-accent)] border-[var(--landing-accent)]/30' },
    '1-2': { label: 'Martin toiture', time: '8h-16h', color: 'bg-[var(--landing-accent)]/15 text-[var(--landing-accent)] border-[var(--landing-accent)]/30' },
    '1-4': { label: 'Réunion', time: '10h-11h', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    '2-0': { label: 'Leroy plomb.', time: '9h-12h', color: 'bg-[var(--landing-accent)]/15 text-[var(--landing-accent)] border-[var(--landing-accent)]/30' },
    '2-1': { label: 'RDV Petit', time: '14h-15h', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    '2-2': { label: 'Bernard clim', time: '9h-17h', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    '2-3': { label: 'Bernard clim', time: '9h-17h', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    '2-4': { label: 'Réunion', time: '10h-11h', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    '3-1': { label: 'Dupont SdB', time: '8h-12h', color: 'bg-[var(--landing-accent)]/15 text-[var(--landing-accent)] border-[var(--landing-accent)]/30' },
    '3-2': { label: 'Dupont SdB', time: '8h-17h', color: 'bg-[var(--landing-accent)]/15 text-[var(--landing-accent)] border-[var(--landing-accent)]/30' },
    '3-3': { label: 'Martin toiture', time: '8h-16h', color: 'bg-[var(--landing-accent)]/15 text-[var(--landing-accent)] border-[var(--landing-accent)]/30' },
  };

  return (
    <div>
      <LandingPageHeader
        title="Planning"
        description="Organisez les interventions de votre équipe"
      >
        <div className="flex items-center gap-1 rounded-lg border border-[var(--landing-border)] bg-white p-0.5">
          <button className="px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--landing-accent)] text-white">
            Semaine
          </button>
          <button className="px-2 py-1 rounded-md text-[10px] font-medium text-[var(--landing-muted)]">
            Mois
          </button>
        </div>
      </LandingPageHeader>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Day headers */}
          <div className="grid grid-cols-[100px_repeat(5,1fr)] gap-1 mb-1">
            <div />
            {days.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-semibold text-[var(--landing-muted)] uppercase tracking-wider pb-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Team rows */}
          {members.map((m, rowIdx) => (
            <div
              key={m.name}
              className="grid grid-cols-[100px_repeat(5,1fr)] gap-1 mb-1"
            >
              <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-[var(--landing-off)]">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ${m.color}`}
                >
                  {m.initials}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-[var(--landing-text)] truncate">
                    {m.name}
                  </div>
                  <div className="text-[8px] text-[var(--landing-muted)] truncate">{m.role}</div>
                </div>
              </div>
              {days.map((_, colIdx) => {
                const ev = events[`${rowIdx}-${colIdx}`];
                return (
                  <div
                    key={colIdx}
                    className="min-h-[56px] rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)] p-1"
                  >
                    {ev && (
                      <div className={`h-full rounded-md border px-1.5 py-1 ${ev.color}`}>
                        <div className="text-[9px] font-semibold truncate">{ev.label}</div>
                        <div className="text-[8px] opacity-80 truncate">{ev.time}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--landing-border)] flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-[var(--landing-accent)]" />
          <span className="text-[9px] text-[var(--landing-muted)]">Chantier</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-blue-400" />
          <span className="text-[9px] text-[var(--landing-muted)]">RDV / Intervention</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-purple-400" />
          <span className="text-[9px] text-[var(--landing-muted)]">Réunion</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-slate-400" />
          <span className="text-[9px] text-[var(--landing-muted)]">Congé</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   11. CARTE — Leaflet + legend overlay
   ════════════════════════════════════════════════════════════════════ */

function CarteView() {
  const [filter, setFilter] = useState('all');
  const filters = [
    { key: 'all', label: 'Tous' },
    { key: 'en_cours', label: 'En cours' },
    { key: 'termine', label: 'Terminés' },
    { key: 'prospect', label: 'Prospects' },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Carte des chantiers"
        description="Visualisez vos chantiers sur la carte"
      />

      <div className="flex flex-wrap gap-1 sm:gap-2 mb-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${
              filter === f.key
                ? 'bg-[var(--landing-accent)] text-white'
                : 'bg-white border border-[var(--landing-border)] text-[var(--landing-muted)] hover:bg-[var(--landing-stone)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative border border-[var(--landing-border)] rounded-xl overflow-hidden">
        <LandingMap className="h-[260px] sm:h-[380px]" filter={filter} />

        {/* Legend overlay */}
        <div className="absolute top-3 left-3 rounded-lg bg-white/95 backdrop-blur border border-[var(--landing-border)] px-3 py-2 shadow-lg">
          <div className="text-[9px] font-semibold text-[var(--landing-text)] uppercase tracking-wider mb-1.5">
            Statut
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] text-[var(--landing-text)]">En cours</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-[var(--landing-text)]">Terminé</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-[10px] text-[var(--landing-text)]">À planifier</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[10px] text-[var(--landing-text)]">En pause</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   12. ÉQUIPE
   ════════════════════════════════════════════════════════════════════ */

function EquipeView() {
  const team = [
    { name: 'Lucas Martin', initials: 'LM', speciality: 'Plomberie · Chaudière', type: 'Salarié', typeColor: 'bg-blue-50 text-blue-700', status: 'Actif', statusColor: 'bg-emerald-50 text-emerald-700', hours: '34 h' },
    { name: 'Sarah Dubois', initials: 'SD', speciality: 'Carrelage · Faïence', type: 'Sous-traitant', typeColor: 'bg-amber-50 text-amber-700', status: 'Actif', statusColor: 'bg-emerald-50 text-emerald-700', hours: '18 h' },
    { name: 'Mehdi Benali', initials: 'MB', speciality: 'Électricité', type: 'Intérimaire', typeColor: 'bg-purple-50 text-purple-700', status: 'Actif', statusColor: 'bg-emerald-50 text-emerald-700', hours: '26 h' },
    { name: 'Thomas Bernard', initials: 'TB', speciality: 'Maçonnerie · Toiture', type: 'Salarié', typeColor: 'bg-blue-50 text-blue-700', status: 'Actif', statusColor: 'bg-emerald-50 text-emerald-700', hours: '40 h' },
  ];

  const filters = ['Tous', 'Salariés', 'Sous-traitants', 'Intérimaires'];

  return (
    <div>
      <LandingPageHeader
        title="Équipe"
        description="Salariés, sous-traitants et intérimaires"
      />

      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {filters.map((f, i) => (
          <button
            key={f}
            type="button"
            className={`px-3 py-1 rounded-full text-[10px] font-medium ${
              i === 0
                ? 'bg-[var(--landing-accent)] text-white'
                : 'bg-white border border-[var(--landing-border)] text-[var(--landing-muted)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {team.map((m) => (
          <div
            key={m.name}
            className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-white px-4 py-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] font-semibold text-xs">
              {m.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-[var(--landing-text)]">{m.name}</span>
              </div>
              <div className="text-[10px] text-[var(--landing-muted)]">{m.speciality}</div>
              <div className="flex items-center gap-1 mt-1">
                <Badge label={m.type} color={m.typeColor} />
                <Badge label={m.status} color={m.statusColor} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-semibold text-[var(--landing-text)]">{m.hours}</div>
              <div className="text-[9px] text-[var(--landing-muted)]">cette sem.</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   13. CATALOGUES
   ════════════════════════════════════════════════════════════════════ */

function CataloguesView() {
  const catalogs = [
    { name: 'Salle de bain premium', items: 18, shared: true },
    { name: 'Chauffage & chaudière', items: 12, shared: true },
    { name: 'Climatisation mono-split', items: 9, shared: false },
    { name: 'Plomberie essentielle', items: 15, shared: true },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Catalogues"
        description="Créez et partagez des catalogues produits avec vos clients"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {catalogs.map((catalog) => (
          <div
            key={catalog.name}
            className="rounded-xl border border-[var(--landing-border)] bg-white overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="h-20 bg-gradient-to-br from-[var(--landing-accent)]/20 via-[var(--landing-accent)]/10 to-transparent flex items-center justify-center relative">
              <BookOpen className="w-7 h-7 text-[var(--landing-accent)]" />
              {catalog.shared && (
                <div className="absolute top-2 right-2">
                  <Badge
                    label="Magic link actif"
                    color="bg-emerald-50 text-emerald-700 border border-emerald-200"
                  />
                </div>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--landing-text)] truncate">
                    {catalog.name}
                  </div>
                  <div className="text-[10px] text-[var(--landing-muted)]">
                    {catalog.items} produits
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--landing-muted)] shrink-0" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   14. PROSPECTION — 6-column Kanban matching lead-pipeline.ts
   ════════════════════════════════════════════════════════════════════ */

function ProspectionView() {
  const stages: {
    key: string;
    label: string;
    color: string;
    bar: string;
    cards: { name: string; value: string; source: string; date: string }[];
  }[] = [
    {
      key: 'nouveau',
      label: 'Nouveau',
      color: 'bg-slate-100 text-slate-700',
      bar: 'bg-slate-400',
      cards: [
        { name: 'M. Garnier', value: '4 200 €', source: 'Site web', date: 'Il y a 1h' },
        { name: 'Mme Rossi', value: '8 500 €', source: 'Appel', date: 'Il y a 3h' },
        { name: 'SARL Toit', value: '12 000 €', source: 'Recommandation', date: 'Aujourd\u2019hui' },
      ],
    },
    {
      key: 'contacte',
      label: 'Contacté',
      color: 'bg-blue-50 text-blue-700',
      bar: 'bg-blue-400',
      cards: [
        { name: 'M. Dupont', value: '8 500 €', source: 'Google', date: 'Hier' },
        { name: 'Mme Chen', value: '3 200 €', source: 'Facebook', date: 'Il y a 2j' },
      ],
    },
    {
      key: 'devis',
      label: 'Devis envoyé',
      color: 'bg-amber-50 text-amber-700',
      bar: 'bg-amber-400',
      cards: [
        { name: 'SCI Martin', value: '15 800 €', source: 'Recommandation', date: 'Il y a 2j' },
        { name: 'M. Leroy', value: '6 300 €', source: 'Site web', date: 'Il y a 4j' },
        { name: 'Mme Petit', value: '2 100 €', source: 'Google', date: 'Il y a 5j' },
      ],
    },
    {
      key: 'nego',
      label: 'En négo',
      color: 'bg-orange-50 text-orange-700',
      bar: 'bg-orange-500',
      cards: [{ name: 'Boulangerie Paul', value: '9 400 €', source: 'Pappers', date: 'Il y a 1 sem.' }],
    },
    {
      key: 'gagne',
      label: 'Gagné',
      color: 'bg-emerald-50 text-emerald-700',
      bar: 'bg-emerald-500',
      cards: [
        { name: 'Mme Bernard', value: '4 200 €', source: 'Google', date: 'Il y a 2 sem.' },
        { name: 'M. Moreau', value: '18 200 €', source: 'Recommandation', date: 'Il y a 3 sem.' },
      ],
    },
    {
      key: 'perdu',
      label: 'Perdu',
      color: 'bg-red-50 text-red-700',
      bar: 'bg-red-400',
      cards: [{ name: 'M. Nguyen', value: '7 500 €', source: 'Facebook', date: 'Il y a 2 sem.' }],
    },
  ];

  return (
    <div>
      <LandingPageHeader title="Prospection" description="Suivez vos leads et opportunités" />

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-2 px-2">
        {stages.map((col) => (
          <div key={col.key} className="min-w-[180px] w-[180px] shrink-0">
            <div className={`h-0.5 rounded-full ${col.bar} mb-2`} />
            <div className="flex items-center justify-between mb-2">
              <Badge label={col.label} color={col.color} />
              <span className="text-[10px] font-semibold text-[var(--landing-muted)] tabular-nums">
                {col.cards.length}
              </span>
            </div>
            <div className="space-y-2">
              {col.cards.map((card, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-white border border-[var(--landing-border)] shadow-sm"
                >
                  <div className="text-[11px] font-semibold text-[var(--landing-text)] truncate">
                    {card.name}
                  </div>
                  <div className="text-[11px] font-bold text-[var(--landing-accent)] mt-0.5">
                    {card.value}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--landing-stone)] text-[var(--landing-muted)] font-medium">
                      {card.source}
                    </span>
                    <span className="text-[8px] text-[var(--landing-muted)] ml-auto">
                      {card.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   15. BOÎTE MAIL (Gmail intégré)
   ════════════════════════════════════════════════════════════════════ */

type DemoEmail = {
  from: string;
  email: string;
  subject: string;
  preview: string;
  body: string;
  aiReply: string;
  time: string;
  unread: boolean;
};

function EmailsView() {
  const folders = [
    { name: 'Boîte de réception', count: 12, active: true, icon: Mail },
    { name: 'Envoyés', count: null, active: false, icon: Mail },
    { name: 'Étoilés', count: null, active: false, icon: Star },
    { name: 'Corbeille', count: null, active: false, icon: Mail },
  ];
  const emails: DemoEmail[] = [
    {
      from: 'M. Dupont',
      email: 'jean.dupont@gmail.com',
      subject: 'Re: Devis salle de bain',
      preview: 'Bonjour, le devis me convient, on peut démarrer...',
      body:
        'Bonjour,\n\nJ\u2019ai bien reçu votre devis pour la rénovation de ma salle de bain et il me convient parfaitement.\n\nQuand pourriez-vous démarrer les travaux ? Je suis disponible à partir de la semaine prochaine.\n\nMerci et bonne journée,\nJean Dupont',
      aiReply:
        'Bonjour M. Dupont,\n\nMerci beaucoup pour votre retour positif sur le devis !\n\nJe peux démarrer les travaux le lundi 13 avril. Je passerai lundi matin à 8h30 avec mon équipe pour commencer la dépose.\n\nJe vous envoie d\u2019ici ce soir le lien de signature électronique du devis ainsi que la demande d\u2019acompte de 30 %.\n\nÀ très bientôt,\nLéo Martin — Hellobat',
      time: '10:32',
      unread: true,
    },
    {
      from: 'Mme Bernard',
      email: 'sophie.bernard@orange.fr',
      subject: 'Demande de devis toiture',
      preview: 'Suite à notre conversation, pouvez-vous...',
      body:
        'Bonjour,\n\nSuite à notre conversation téléphonique de ce matin, pouvez-vous me transmettre un devis pour la réfection complète de ma toiture (environ 120 m²) ?\n\nLa maison se situe au 14 rue des Tilleuls à Lyon 7e. Je suis disponible cette semaine pour une visite technique.\n\nCordialement,\nSophie Bernard',
      aiReply:
        'Bonjour Mme Bernard,\n\nMerci pour votre demande. Je peux passer jeudi 11 avril à 10h pour effectuer le relevé de votre toiture au 14 rue des Tilleuls.\n\nJe vous transmettrai le devis complet sous 48h après la visite.\n\nÀ jeudi,\nLéo Martin — Hellobat',
      time: '09:15',
      unread: true,
    },
    {
      from: 'SAS Martin',
      email: 'commande@sas-martin.fr',
      subject: 'Commande matériaux confirmée',
      preview: 'Votre commande a été préparée...',
      body:
        'Bonjour,\n\nVotre commande n°42-8317 a été préparée et sera livrée demain entre 8h et 12h sur le chantier de la rue des Lilas.\n\nMerci de votre confiance,\nL\u2019équipe SAS Martin',
      aiReply:
        'Bonjour,\n\nBien reçu, merci pour la confirmation. Un membre de l\u2019équipe sera présent demain matin pour réceptionner la livraison.\n\nCordialement,\nLéo Martin — Hellobat',
      time: 'Hier',
      unread: false,
    },
    {
      from: 'M. Leroy',
      email: 'p.leroy@free.fr',
      subject: 'Facture réglée',
      preview: 'Merci pour votre travail impeccable...',
      body:
        'Bonjour,\n\nJe viens de régler la facture F-2026-0142 par virement. Merci pour votre travail impeccable sur notre cuisine, nous en sommes ravis !\n\nN\u2019hésitez pas à me recontacter pour que je laisse un avis Google.\n\nCordialement,\nPierre Leroy',
      aiReply:
        'Bonjour M. Leroy,\n\nMerci beaucoup pour votre règlement rapide et pour votre retour qui me fait très plaisir !\n\nSi vous le souhaitez, voici le lien direct pour laisser un avis Google : https://g.page/r/hellobat-avis\n\nUn grand merci pour votre confiance,\nLéo Martin — Hellobat',
      time: 'Hier',
      unread: false,
    },
    {
      from: 'Fournisseur Pro',
      email: 'contact@fournisseur-pro.fr',
      subject: 'Nouvelles références',
      preview: 'Découvrez notre nouveau catalogue...',
      body:
        'Bonjour,\n\nDécouvrez notre nouveau catalogue 2026 avec plus de 300 références carrelage et sanitaires, livraison sous 48h en Île-de-France.\n\nCatalogue en pièce jointe.\n\nCordialement,\nFournisseur Pro',
      aiReply:
        'Bonjour,\n\nMerci pour l\u2019envoi du catalogue, je vais l\u2019étudier et reviendrai vers vous pour les prochaines commandes.\n\nBonne journée,\nLéo Martin — Hellobat',
      time: 'Lun',
      unread: false,
    },
  ];

  const [selected, setSelected] = useState<number | null>(null);
  // Per-email AI state: 'idle' | 'generating' | 'generated'
  const [aiState, setAiState] = useState<'idle' | 'generating' | 'generated'>('idle');
  const [sentToast, setSentToast] = useState(false);

  function openEmail(idx: number) {
    setSelected(idx);
    setAiState('idle');
  }
  function closeModal() {
    setSelected(null);
    setAiState('idle');
  }
  function generateReply() {
    setAiState('generating');
    // Simulate ~1.2s of "Claude is thinking" before revealing the pre-loaded
    // reply. The text itself is hardcoded per email (`aiReply`) — no API call.
    setTimeout(() => setAiState('generated'), 1200);
  }
  function sendReply() {
    closeModal();
    setSentToast(true);
    setTimeout(() => setSentToast(false), 3000);
  }

  const current = selected !== null ? emails[selected] : null;

  return (
    <div className="relative">
      <LandingPageHeader title="Boîte mail" description="Gmail intégré à votre CRM">
        <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Gmail synchronisé
        </span>
      </LandingPageHeader>

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        {/* Folders */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-2 space-y-0.5 h-fit">
          {folders.map((f) => (
            <button
              key={f.name}
              type="button"
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-left ${
                f.active
                  ? 'bg-white text-[var(--landing-text)] shadow-sm'
                  : 'text-[var(--landing-muted)] hover:bg-white/60'
              }`}
            >
              <f.icon
                className={`w-3.5 h-3.5 ${f.active ? 'text-[var(--landing-accent)]' : ''}`}
              />
              <span className="flex-1 truncate">{f.name}</span>
              {f.count !== null && (
                <span className="text-[9px] font-bold text-[var(--landing-accent)]">{f.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Inbox */}
        <div className="border border-[var(--landing-border)] rounded-xl overflow-hidden bg-white divide-y divide-[var(--landing-border)]">
          {emails.map((e, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => openEmail(idx)}
              className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-[var(--landing-off)] transition-colors cursor-pointer text-left ${
                e.unread ? 'bg-[var(--landing-accent)]/[0.03]' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] flex items-center justify-center shrink-0 text-[10px] font-bold">
                {e.from[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] ${
                      e.unread ? 'font-bold' : 'font-medium'
                    } text-[var(--landing-text)] truncate`}
                  >
                    {e.from}
                  </span>
                  {e.unread && <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)]" />}
                </div>
                <div className="text-[11px] text-[var(--landing-text)] truncate">{e.subject}</div>
                <div className="text-[10px] text-[var(--landing-muted)] truncate">{e.preview}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[9px] text-[var(--landing-muted)]">{e.time}</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] px-1.5 py-0.5 text-[8px] font-semibold">
                  <Sparkles className="w-2 h-2" />
                  Claude
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal — opened when a row is clicked. Fixed overlay so it sits on top
          of the DemoApp chrome without breaking its layout. */}
      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-mail-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-[var(--landing-border)] px-4 sm:px-5 py-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] flex items-center justify-center shrink-0 text-xs font-bold">
                {current.from[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  id="demo-mail-modal-title"
                  className="text-sm font-semibold text-[var(--landing-text)] truncate"
                >
                  {current.subject}
                </div>
                <div className="text-[11px] text-[var(--landing-muted)] truncate">
                  {current.from} &lt;{current.email}&gt; · {current.time}
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fermer"
                className="p-1.5 rounded-md hover:bg-[var(--landing-off)] text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Email body */}
            <div className="px-4 sm:px-5 py-4 border-b border-[var(--landing-border)]">
              <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[var(--landing-text)]">
                {current.body}
              </pre>
            </div>

            {/* AI reply section */}
            <div className="px-4 sm:px-5 py-4">
              {aiState === 'idle' && (
                <div className="flex flex-col items-center text-center gap-2 py-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--landing-accent)]/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-[var(--landing-accent)]" />
                  </div>
                  <div className="text-xs font-semibold text-[var(--landing-text)]">
                    Laissez Claude rédiger votre réponse
                  </div>
                  <p className="text-[11px] text-[var(--landing-muted)] max-w-sm">
                    L&apos;IA analyse le contexte du client (devis, factures, chantiers) et rédige
                    une réponse adaptée en quelques secondes.
                  </p>
                  <button
                    type="button"
                    onClick={generateReply}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--landing-accent)] text-white px-3.5 py-2 text-[11px] font-semibold shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-3 h-3" />
                    Générer une réponse avec IA
                  </button>
                </div>
              )}

              {aiState === 'generating' && (
                <div className="flex flex-col items-center text-center gap-2 py-6">
                  <Loader2 className="w-6 h-6 text-[var(--landing-accent)] animate-spin" />
                  <div className="text-xs font-semibold text-[var(--landing-text)]">
                    Claude rédige votre réponse…
                  </div>
                  <p className="text-[10px] text-[var(--landing-muted)]">
                    Analyse du contexte client en cours
                  </p>
                </div>
              )}

              {aiState === 'generated' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                      <Sparkles className="w-2.5 h-2.5" />
                      Rédigé par Claude
                    </span>
                    <span className="text-[10px] text-[var(--landing-muted)]">
                      Basé sur l&apos;historique client
                    </span>
                  </div>
                  <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-off)] p-3">
                    <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[var(--landing-text)]">
                      {current.aiReply}
                    </pre>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={generateReply}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--landing-border)] bg-white text-[var(--landing-text)] px-3 py-1.5 text-[11px] font-semibold hover:bg-[var(--landing-off)] transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Régénérer
                    </button>
                    <button
                      type="button"
                      onClick={sendReply}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--landing-accent)] text-white px-3.5 py-1.5 text-[11px] font-semibold shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <Send className="w-3 h-3" />
                      Envoyer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sent toast — fixed top-right, auto-dismisses after 3 s */}
      {sentToast && (
        <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 shadow-2xl shadow-emerald-600/30">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[12px] font-semibold">Email envoyé</div>
              <div className="text-[10px] opacity-90">Votre réponse a bien été transmise</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   16. AVIS GOOGLE
   ════════════════════════════════════════════════════════════════════ */

function AvisView() {
  const reviews = [
    { name: 'Pierre L.', text: 'Travail impeccable sur ma salle de bain. Équipe ponctuelle et soignée. Je recommande vivement.', stars: 5, date: 'Il y a 2 jours' },
    { name: 'Sophie M.', text: 'Très professionnel. Le devis a été respecté à l\u2019euro près. Chantier propre et fini en temps.', stars: 5, date: 'Il y a 1 semaine' },
    { name: 'Jean D.', text: 'Bon travail dans l\u2019ensemble, petit retard au démarrage mais résultat conforme.', stars: 4, date: 'Il y a 2 semaines' },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Avis Google"
        description="Gérez vos avis Google Business Profile"
      >
        <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Synchronisé
        </span>
      </LandingPageHeader>

      <div className="flex items-center gap-6 p-4 rounded-xl bg-white border border-[var(--landing-border)] mb-4">
        <div className="text-center shrink-0">
          <div className="text-3xl font-bold text-[var(--landing-text)]">4.9</div>
          <div className="text-amber-500 text-sm">★★★★★</div>
          <div className="text-[10px] text-[var(--landing-muted)]">127 avis</div>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--landing-muted)] w-3">{s}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--landing-stone)]">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: s === 5 ? '85%' : s === 4 ? '12%' : '3%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {reviews.map((r) => (
          <div
            key={r.name}
            className="p-3 rounded-xl border border-[var(--landing-border)] bg-white"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-[var(--landing-accent)]/10 flex items-center justify-center shrink-0 text-[9px] font-bold text-[var(--landing-accent)]">
                {r.name[0]}
              </div>
              <span className="text-xs font-semibold text-[var(--landing-text)]">{r.name}</span>
              <span className="text-amber-500 text-[10px]">{'★'.repeat(r.stars)}</span>
              <span className="text-[10px] text-[var(--landing-muted)] ml-auto">{r.date}</span>
            </div>
            <p className="text-xs text-[var(--landing-muted)] leading-relaxed mb-2">{r.text}</p>
            <button className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--landing-accent)] hover:opacity-80">
              <Sparkles className="w-3 h-3" />
              Répondre avec Claude
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   17. AGENTS IA — 5 official agents from CLAUDE.md
   ════════════════════════════════════════════════════════════════════ */

function AgentsView() {
  const agents = [
    {
      name: 'Agent Pannes',
      emoji: '🔧',
      icon: Wrench,
      desc: 'Diagnostic des pannes courantes : chaudière, clim, fuite, électricité',
      color: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
    },
    {
      name: 'Agent DTU & Normes',
      emoji: '📘',
      icon: BookOpen,
      desc: 'Consultation instantanée des DTU, normes françaises et règles de l\u2019art',
      color: 'bg-emerald-50 border-emerald-200',
      iconColor: 'text-emerald-600',
    },
    {
      name: 'Agent Chiffreur',
      emoji: '🧮',
      icon: Calculator,
      desc: 'Calculez vos métrés et prix au m² à partir d\u2019une description de projet',
      color: 'bg-[var(--landing-accent)]/10 border-[var(--landing-accent)]/30',
      iconColor: 'text-[var(--landing-accent)]',
    },
    {
      name: 'Agent Juridique',
      emoji: '⚖️',
      icon: Scale,
      desc: 'Contrats, garantie décennale, réserves, litiges clients — votre juriste IA',
      color: 'bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600',
    },
    {
      name: 'Agent RGE / CEE',
      emoji: '🌿',
      icon: Leaf,
      desc: 'Aides, primes CEE, MaPrimeRénov\u2019, éligibilité RGE — tout le rénovation énergétique',
      color: 'bg-teal-50 border-teal-200',
      iconColor: 'text-teal-600',
    },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Agents IA experts"
        description="Des agents spécialisés pour vous assister au quotidien"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const Icon = a.icon;
          return (
            <div
              key={a.name}
              className={`p-4 rounded-xl border ${a.color} hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                  <Icon className={`w-4 h-4 ${a.iconColor}`} />
                </div>
                <span className="text-lg">{a.emoji}</span>
              </div>
              <div className="text-xs font-semibold text-[var(--landing-text)] mb-1">{a.name}</div>
              <p className="text-[10px] text-[var(--landing-muted)] leading-relaxed mb-3">
                {a.desc}
              </p>
              <button className="inline-flex items-center gap-1 rounded-lg bg-[var(--landing-accent)] text-white px-2.5 py-1.5 text-[10px] font-semibold shadow-sm">
                <Sparkles className="w-2.5 h-2.5" />
                Démarrer une conversation
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   18. AVANT / APRÈS IA (rendus)
   ════════════════════════════════════════════════════════════════════ */

function RendusView() {
  const transforms = [
    { label: 'Cuisine rénovée', style: 'Moderne', color: 'from-orange-200 to-orange-400' },
    { label: 'Salle de bain', style: 'Contemporaine', color: 'from-blue-200 to-blue-400' },
    { label: 'Façade repeinte', style: 'Pierre naturelle', color: 'from-amber-200 to-amber-400' },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Avant/Après IA"
        description="Transformez vos photos de chantier avec l'IA"
      >
        <span className="text-[10px] font-medium text-[var(--landing-muted)]">
          Générations ce mois : <span className="font-bold text-[var(--landing-text)]">14</span>
        </span>
      </LandingPageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        {transforms.map((t) => (
          <div
            key={t.label}
            className="rounded-xl border border-[var(--landing-border)] bg-white overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              {/* Before (left) */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center">
                <Camera className="w-8 h-8 text-white/70" />
              </div>
              {/* After (right, clipped diagonal) */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${t.color} flex items-center justify-center`}
                style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 40% 100%)' }}
              >
                <Wand2 className="w-8 h-8 text-white drop-shadow" />
              </div>
              {/* Labels */}
              <div className="absolute bottom-2 left-2 text-[9px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">
                AVANT
              </div>
              <div className="absolute top-2 right-2 text-[9px] font-bold text-white bg-[var(--landing-accent)] px-1.5 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="w-2 h-2" />
                APRÈS
              </div>
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-[var(--landing-text)]">{t.label}</div>
              <div className="text-[10px] text-[var(--landing-muted)] mt-0.5">Style : {t.style}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   19. SITE WEB IA
   ════════════════════════════════════════════════════════════════════ */

function SiteWebView() {
  const steps = [
    { n: 1, label: 'Vos informations', done: true },
    { n: 2, label: 'Vos réalisations', done: true },
    { n: 3, label: 'Rédaction IA', done: true },
    { n: 4, label: 'Publication', done: false, active: true },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Site web IA"
        description="Générez votre site en quelques clics avec Claude"
      >
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-[#D97706]/10 text-[#D97706] font-semibold">
          <Sparkles className="w-2.5 h-2.5" /> Claude a rédigé 87% du contenu
        </span>
      </LandingPageHeader>

      <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
        {/* Wizard */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-4">
          <div className="text-[10px] font-semibold text-[var(--landing-muted)] uppercase tracking-wider mb-3">
            Assistant
          </div>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-start gap-2">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                    s.done
                      ? 'bg-emerald-500 text-white'
                      : s.active
                        ? 'bg-[var(--landing-accent)] text-white ring-2 ring-[var(--landing-accent)]/30'
                        : 'bg-[var(--landing-stone)] text-[var(--landing-muted)]'
                  }`}
                >
                  {s.done ? <Check className="w-3 h-3" /> : s.n}
                </div>
                <div className="flex-1 pt-0.5">
                  <div
                    className={`text-[11px] font-medium ${
                      s.done || s.active
                        ? 'text-[var(--landing-text)]'
                        : 'text-[var(--landing-muted)]'
                    }`}
                  >
                    {s.label}
                  </div>
                  {s.active && (
                    <div className="text-[9px] text-[var(--landing-accent)] mt-0.5">En cours…</div>
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute -mt-1" aria-hidden />
                )}
              </div>
            ))}
          </div>
          <button className="w-full mt-4 rounded-lg bg-[var(--landing-accent)] text-white py-2 text-[10px] font-semibold shadow-sm">
            Publier le site
          </button>
        </div>

        {/* Site preview (browser mock) */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-white overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <span className="w-2 h-2 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[9px] text-[var(--landing-muted)] ml-2 font-mono">
              hellobat.app/leroy-plomberie
            </span>
          </div>
          <div>
            {/* Hero */}
            <div className="bg-gradient-to-br from-[var(--landing-accent)]/10 via-[var(--landing-stone)] to-transparent p-4 sm:p-6">
              <div className="text-base sm:text-lg font-serif text-[var(--landing-text)] mb-1">
                Leroy Plomberie
              </div>
              <div className="text-[10px] sm:text-xs text-[var(--landing-muted)] mb-3">
                Votre plombier de confiance à Lyon depuis 1998
              </div>
              <div className="flex gap-2">
                <button className="rounded-md bg-[var(--landing-accent)] text-white px-2.5 py-1 text-[9px] font-semibold">
                  Demander un devis
                </button>
                <button className="rounded-md border border-[var(--landing-border)] bg-white px-2.5 py-1 text-[9px] font-medium text-[var(--landing-text)]">
                  Nos réalisations
                </button>
              </div>
            </div>
            {/* Services */}
            <div className="p-3 grid grid-cols-3 gap-2">
              {['Dépannage', 'Rénovation', 'Entretien'].map((s) => (
                <div
                  key={s}
                  className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-off)] p-2 text-center"
                >
                  <div className="w-5 h-5 rounded-full bg-[var(--landing-accent)]/10 mx-auto mb-1 flex items-center justify-center">
                    <Wrench className="w-2.5 h-2.5 text-[var(--landing-accent)]" />
                  </div>
                  <div className="text-[9px] font-semibold text-[var(--landing-text)]">{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   20. PAIEMENTS STRIPE
   ════════════════════════════════════════════════════════════════════ */

function HelloPayView() {
  const recentPayments = [
    { client: 'M. Dupont', montant: '850 €', date: 'il y a 2 min', mode: 'QR Code', status: 'Payé' },
    { client: 'Mme Bernard', montant: '1 200 €', date: 'il y a 15 min', mode: 'Carte', status: 'Payé' },
    { client: 'M. Lefebvre', montant: '320 €', date: 'il y a 1h', mode: 'QR Code', status: 'Payé' },
  ];

  return (
    <div>
      <LandingPageHeader
        title="HelloPay"
        description="Encaissez vos clients en 10 secondes"
      />

      {/* Premium banner */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-400/15 to-orange-500/10 border border-amber-400/30 ring-1 ring-amber-300/20 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-[var(--landing-text)] flex items-center gap-1.5">
            HelloPay
            <Sparkles className="w-3 h-3 text-amber-500" />
          </div>
          <div className="text-[10px] text-[var(--landing-muted)]">
            QR Code + Carte · Commission 0,5% · Argent direct sur votre compte
          </div>
        </div>
        <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">Aujourd&apos;hui</div>
          <div className="text-base sm:text-lg font-bold text-amber-800 mt-1">2 370 €</div>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-[10px] text-emerald-700 font-medium uppercase tracking-wide">Ce mois</div>
          <div className="text-base sm:text-lg font-bold text-emerald-800 mt-1">18 450 €</div>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
          <div className="text-[10px] text-blue-700 font-medium uppercase tracking-wide">Paiements</div>
          <div className="text-base sm:text-lg font-bold text-blue-800 mt-1">47</div>
        </div>
      </div>

      {/* Quick payment form mockup */}
      <div className="p-4 rounded-xl border border-[var(--landing-border)] bg-white mb-4">
        <div className="text-xs font-semibold text-[var(--landing-text)] mb-3">Nouvel encaissement</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2.5 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)]">
            <div className="text-[10px] text-[var(--landing-muted)]">Client</div>
            <div className="text-xs font-medium text-[var(--landing-text)] mt-0.5">M. Dupont</div>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)]">
            <div className="text-[10px] text-[var(--landing-muted)]">Montant TTC</div>
            <div className="text-xs font-medium text-[var(--landing-text)] mt-0.5">850,00 €</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-medium">
            <ScanLine className="w-3.5 h-3.5" />
            QR Code
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--landing-border)] text-xs font-medium text-[var(--landing-text)]">
            <CreditCard className="w-3.5 h-3.5" />
            Carte
          </button>
        </div>
      </div>

      {/* Recent payments */}
      <div className="space-y-2">
        {recentPayments.map((p, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--landing-border)] bg-white">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--landing-text)]">{p.client}</div>
              <div className="text-[10px] text-[var(--landing-muted)]">{p.date} · {p.mode}</div>
            </div>
            <div className="text-xs font-bold text-emerald-700">{p.montant}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaiementView() {
  const payments = [
    { client: 'M. Dupont', montant: '8 500 €', date: '24 mar. 2026', status: 'Payé', color: 'bg-emerald-50 text-emerald-700', method: 'Carte' },
    { client: 'Mme Bernard', montant: '4 200 €', date: '22 mar. 2026', status: 'Lien envoyé', color: 'bg-blue-50 text-blue-700', method: 'Lien' },
    { client: 'SCI Martin', montant: '15 800 €', date: '20 mar. 2026', status: 'En retard', color: 'bg-red-50 text-red-700', method: 'Carte' },
    { client: 'M. Dupont', montant: '420 €', date: '1 avr. 2026', status: 'Payé', color: 'bg-emerald-50 text-emerald-700', method: 'Auto' },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Paiement Stripe"
        description="Recevez vos paiements en ligne par Stripe"
      />

      {/* Stripe Connect banner */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#635bff]/10 to-[#635bff]/5 border border-[#635bff]/20 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#635bff]/20 flex items-center justify-center shrink-0">
          <CreditCard className="w-4 h-4 text-[#635bff]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-[var(--landing-text)]">
            Stripe Connect actif
          </div>
          <div className="text-[10px] text-[var(--landing-muted)]">
            Commission plateforme : 1% · Paiement direct sur votre compte
          </div>
        </div>
        <CheckCircle2 className="w-4 h-4 text-[#635bff] shrink-0" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-[10px] text-emerald-700 font-medium uppercase tracking-wide">
            Encaissé
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-800 mt-1">26 800 €</div>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
          <div className="text-[10px] text-blue-700 font-medium uppercase tracking-wide">
            En attente
          </div>
          <div className="text-base sm:text-lg font-bold text-blue-800 mt-1">4 200 €</div>
        </div>
        <div className="p-3 rounded-xl bg-red-50 border border-red-200">
          <div className="text-[10px] text-red-700 font-medium uppercase tracking-wide">
            En retard
          </div>
          <div className="text-base sm:text-lg font-bold text-red-800 mt-1">15 800 €</div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block border border-[var(--landing-border)] rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--landing-off)] text-[10px] font-medium text-[var(--landing-muted)] uppercase tracking-wider">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, i) => (
              <tr key={i} className="border-t border-[var(--landing-border)]">
                <td className="px-4 py-3 text-xs font-medium text-[var(--landing-text)]">
                  {p.client}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-[var(--landing-text)] text-right">
                  {p.montant}
                </td>
                <td className="px-4 py-3 text-[10px] text-[var(--landing-muted)]">{p.method}</td>
                <td className="px-4 py-3 text-xs text-[var(--landing-muted)]">{p.date}</td>
                <td className="px-4 py-3">
                  <Badge label={p.status} color={p.color} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {payments.map((p, i) => (
          <div
            key={i}
            className="p-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-[var(--landing-text)]">{p.client}</span>
              <Badge label={p.status} color={p.color} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--landing-muted)]">
                {p.date} · {p.method}
              </span>
              <span className="text-xs font-semibold text-[var(--landing-text)]">{p.montant}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   21. CONTRATS RÉCURRENTS
   ════════════════════════════════════════════════════════════════════ */

function ContratsView() {
  const contracts = [
    { type: 'Entretien chaudière', client: 'M. Dupont', montant: '420 €', freq: 'Annuel', next: '15 juin 2026', icon: Flame, color: 'bg-orange-50 text-orange-700', iconColor: 'text-orange-600' },
    { type: 'Maintenance clim', client: 'Mme Petit', montant: '350 €', freq: 'Trimestriel', next: '1 juil. 2026', icon: Wind, color: 'bg-blue-50 text-blue-700', iconColor: 'text-blue-600' },
    { type: 'Entretien piscine', client: 'SCI Martin', montant: '250 €', freq: 'Mensuel', next: '1 mai 2026', icon: Waves, color: 'bg-cyan-50 text-cyan-700', iconColor: 'text-cyan-600' },
    { type: 'Ramonage cheminée', client: 'Mme Bernard', montant: '180 €', freq: 'Annuel', next: '1 oct. 2026', icon: Flame, color: 'bg-amber-50 text-amber-700', iconColor: 'text-amber-600' },
  ];

  const mrrData = [
    { value: 2200 }, { value: 2200 }, { value: 2600 }, { value: 2600 },
    { value: 3100 }, { value: 3100 }, { value: 3500 }, { value: 3500 },
    { value: 3800 }, { value: 3800 }, { value: 4200 }, { value: 4200 },
  ];

  return (
    <div>
      <LandingPageHeader
        title="Contrats récurrents"
        description="Maintenance chaudière, clim, piscine — facturés automatiquement"
      />

      {/* MRR KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-[10px] text-emerald-700 font-medium uppercase tracking-wide">
            MRR
          </div>
          <div className="text-lg font-bold text-emerald-800 mt-1">4 200 €</div>
          <div className="text-[9px] text-emerald-700 mt-0.5">+8% ce mois</div>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
          <div className="text-[10px] text-blue-700 font-medium uppercase tracking-wide">ARR</div>
          <div className="text-lg font-bold text-blue-800 mt-1">50 400 €</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--landing-border)] bg-white">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium uppercase tracking-wide">
            Actifs
          </div>
          <div className="text-lg font-bold text-[var(--landing-text)] mt-1">12</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--landing-border)] bg-white">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium uppercase tracking-wide">
            Encaissement
          </div>
          <div className="text-lg font-bold text-[var(--landing-text)] mt-1">96%</div>
        </div>
      </div>

      {/* MRR chart */}
      <div className="rounded-xl border border-[var(--landing-border)] bg-white p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-semibold text-[var(--landing-text)]">Évolution MRR</p>
            <p className="text-[10px] text-[var(--landing-muted)]">12 derniers mois</p>
          </div>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="h-[60px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mrrData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#mrrGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Contracts list */}
      <div className="grid gap-2 sm:grid-cols-2">
        {contracts.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="p-3 rounded-xl border border-[var(--landing-border)] bg-white"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg bg-[var(--landing-off)] flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${c.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="text-xs font-semibold text-[var(--landing-text)] truncate">
                      {c.type}
                    </div>
                    <Badge label={c.freq} color={c.color} />
                  </div>
                  <div className="text-[10px] text-[var(--landing-muted)] mb-1.5">{c.client}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--landing-text)]">
                      {c.montant}
                    </span>
                    <span className="text-[9px] text-[var(--landing-muted)]">
                      Prochaine : {c.next}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   22. COMPTABILITÉ IA — Maurice + OCR + bank reco + cash flow
   ════════════════════════════════════════════════════════════════════ */

const comptaCashflow = [
  { m: 'Jan', rev: 24, dep: 12 },
  { m: 'Fév', rev: 28, dep: 16 },
  { m: 'Mar', rev: 22, dep: 14 },
  { m: 'Avr', rev: 32, dep: 20 },
  { m: 'Mai', rev: 30, dep: 16 },
  { m: 'Juin', rev: 36, dep: 22 },
  { m: 'Juil', rev: 26, dep: 16 },
  { m: 'Aoû', rev: 34, dep: 20 },
  { m: 'Sep', rev: 31, dep: 18 },
  { m: 'Oct', rev: 38, dep: 24 },
  { m: 'Nov', rev: 29, dep: 17 },
  { m: 'Déc', rev: 37, dep: 22 },
];

function ComptaView() {
  return (
    <div>
      <LandingPageHeader
        title="Comptabilité IA"
        description="Vos dépenses et recettes, triées automatiquement par Claude"
      >
        <button className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--landing-border)] bg-white text-[10px] font-medium text-[var(--landing-text)]">
          <Download className="w-3 h-3" />
          Export FEC
        </button>
      </LandingPageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
            <ArrowDownRight className="w-3 h-3" /> Encaissé
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-800 mt-0.5">124 800 €</div>
          <div className="text-[9px] text-emerald-700 mt-0.5">+18% vs N-1</div>
        </div>
        <div className="p-3 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-center gap-1 text-[10px] text-red-700 font-semibold">
            <ArrowUpRight className="w-3 h-3" /> Dépenses
          </div>
          <div className="text-base sm:text-lg font-bold text-red-800 mt-0.5">43 200 €</div>
          <div className="text-[9px] text-red-700 mt-0.5">+5% vs N-1</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-accent)]/10 border border-[var(--landing-accent)]/30">
          <div className="flex items-center gap-1 text-[10px] text-[var(--landing-accent)] font-semibold">
            <TrendingUp className="w-3 h-3" /> Marge nette
          </div>
          <div className="text-base sm:text-lg font-bold text-[var(--landing-accent)] mt-0.5">
            34,8 %
          </div>
          <div className="text-[9px] text-[var(--landing-accent)] mt-0.5">+3,2 pts</div>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-1 text-[10px] text-blue-700 font-semibold">
            <Landmark className="w-3 h-3" /> Trésorerie
          </div>
          <div className="text-base sm:text-lg font-bold text-blue-800 mt-0.5">28 600 €</div>
          <div className="text-[9px] text-blue-700 mt-0.5">Sain</div>
        </div>
      </div>

      {/* OCR + Bank reco */}
      <div className="grid gap-3 lg:grid-cols-2 mb-4">
        {/* OCR */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--landing-accent)]">
              <ScanLine className="h-3.5 w-3.5" />
              Scan OCR d&apos;un ticket
            </div>
            <span className="text-[9px] text-[var(--landing-muted)] flex items-center gap-1">
              <Camera className="w-2.5 h-2.5" /> Photo
            </span>
          </div>
          <div className="rounded-lg bg-white border border-[var(--landing-border)] p-2.5 shadow-sm">
            <div className="flex items-start gap-2.5">
              <div className="w-12 h-14 rounded-md bg-gradient-to-b from-[var(--landing-stone)] to-[var(--landing-border)] shrink-0 flex items-center justify-center relative overflow-hidden">
                <Receipt className="w-5 h-5 text-[var(--landing-muted)]" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[var(--landing-accent)]/70" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-[11px] font-semibold text-[var(--landing-text)] truncate">
                  Leroy Merlin Rivoli
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--landing-stone)] text-[var(--landing-muted)] font-medium">
                    Matériaux
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                    Chantier Petit
                  </span>
                </div>
                <div className="text-[9px] text-[var(--landing-muted)]">07/04/2026 · TVA 20%</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] text-[var(--landing-muted)]">TTC</div>
                <div className="text-sm font-bold text-[var(--landing-text)]">187,42 €</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center">
              <div className="rounded bg-[var(--landing-off)] p-1">
                <div className="text-[8px] text-[var(--landing-muted)]">HT</div>
                <div className="text-[10px] font-semibold text-[var(--landing-text)]">156,18 €</div>
              </div>
              <div className="rounded bg-[var(--landing-off)] p-1">
                <div className="text-[8px] text-[var(--landing-muted)]">TVA</div>
                <div className="text-[10px] font-semibold text-[var(--landing-text)]">31,24 €</div>
              </div>
              <div className="rounded bg-emerald-50 p-1">
                <div className="text-[8px] text-emerald-700">Statut</div>
                <div className="text-[10px] font-semibold text-emerald-800">Classé</div>
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span className="font-medium">
              Claude a tout extrait et archivé · justificatif conforme 10 ans
            </span>
          </div>
        </div>

        {/* Bank reco */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--landing-accent)]">
              <Landmark className="h-3.5 w-3.5" />
              Rapprochement bancaire
            </div>
            <span className="text-[9px] font-medium text-[var(--landing-muted)] bg-[var(--landing-stone)] px-1.5 py-0.5 rounded-full">
              CSV · OFX
            </span>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'VIR Dupont F-2026-089', amt: '+3 200,00', kind: 'Facture payée', state: 'auto' },
              { label: 'CB Leroy Merlin', amt: '−187,42', kind: 'Dépense', state: 'auto' },
              { label: 'PRLV URSSAF', amt: '−842,00', kind: 'Charge sociale', state: 'auto' },
              { label: 'VIR LM RIVOLI', amt: '−54,90', kind: 'Suggéré IA · 89%', state: 'ai' },
              { label: 'FRAIS BANCAIRES', amt: '−4,20', kind: 'À ignorer ?', state: 'pending' },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center gap-2 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)] px-2 py-1.5"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    row.state === 'auto'
                      ? 'bg-emerald-100'
                      : row.state === 'ai'
                        ? 'bg-amber-100'
                        : 'bg-[var(--landing-stone)]'
                  }`}
                >
                  {row.state === 'auto' && <Check className="w-3 h-3 text-emerald-700" />}
                  {row.state === 'ai' && <Sparkles className="w-3 h-3 text-amber-700" />}
                  {row.state === 'pending' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-[var(--landing-text)] truncate">
                    {row.label}
                  </div>
                  <div className="text-[9px] text-[var(--landing-muted)] truncate">{row.kind}</div>
                </div>
                <span
                  className={`text-[10px] font-bold tabular-nums shrink-0 ${
                    row.amt.startsWith('+') ? 'text-emerald-700' : 'text-[var(--landing-text)]'
                  }`}
                >
                  {row.amt} €
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] pt-2 border-t border-[var(--landing-border)]">
            <span className="text-[var(--landing-muted)]">12 / 13 lignes rapprochées</span>
            <span className="font-semibold text-emerald-700">92 %</span>
          </div>
        </div>
      </div>

      {/* Cash flow + margins */}
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-[var(--landing-border)] bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-[var(--landing-text)]">
                Flux de trésorerie
              </p>
              <p className="text-[10px] text-[var(--landing-muted)]">
                12 derniers mois · solde projeté +81 600 €
              </p>
            </div>
            <BarChart3 className="w-4 h-4 text-[var(--landing-muted)]" />
          </div>
          <div className="h-[90px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comptaCashflow} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="rev" fill="var(--landing-accent)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="dep" fill="var(--landing-accent)" fillOpacity={0.25} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-[var(--landing-border)]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[var(--landing-accent)]" />
              <span className="text-[9px] text-[var(--landing-muted)]">Encaissements</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[var(--landing-accent)]/25" />
              <span className="text-[9px] text-[var(--landing-muted)]">Dépenses</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--landing-border)] bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-[var(--landing-text)]">Marges par chantier</p>
              <p className="text-[10px] text-[var(--landing-muted)]">Top 3 ce trimestre</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[var(--landing-muted)]" />
          </div>
          <div className="space-y-2">
            {[
              { name: 'SDB Petit', marge: 42 },
              { name: 'Toiture Bernard', marge: 36 },
              { name: 'Cuisine Martin', marge: 18 },
            ].map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-[var(--landing-text)] truncate">
                    {c.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold tabular-nums ${
                      c.marge >= 30 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    +{c.marge} %
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--landing-stone)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      c.marge >= 30 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${c.marge * 2}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-[var(--landing-border)] flex items-center gap-1.5 text-[9px] text-[var(--landing-accent)]">
            <Zap className="w-3 h-3" />
            <span className="font-medium">Marge moyenne · 34,8 %</span>
          </div>
        </div>
      </div>

      {/* Tools footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {[
          { icon: ScanLine, label: 'Scan ticket', sub: 'OCR Claude' },
          { icon: Landmark, label: 'Rapprochement', sub: 'CSV / OFX' },
          { icon: FileSpreadsheet, label: 'TVA', sub: 'Mensuelle / trim.' },
          { icon: Download, label: 'Export FEC', sub: 'Pour comptable' },
        ].map((t) => (
          <div
            key={t.label}
            className="flex items-center gap-2 p-2 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-off)]"
          >
            <div className="w-7 h-7 rounded-md bg-[var(--landing-accent)]/10 flex items-center justify-center shrink-0">
              <t.icon className="w-3.5 h-3.5 text-[var(--landing-accent)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-[var(--landing-text)] truncate">
                {t.label}
              </div>
              <div className="text-[9px] text-[var(--landing-muted)] truncate">{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
