'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  SquareCheck as CheckSquare,
  Contact,
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
  FileImage,
  TrendingUp,
  Search,
  Plus,
  Send,
  Hexagon,
  Calendar,
  Package,
  CheckCircle2,
  BarChart3,
  PenLine,
} from 'lucide-react';

const views = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'calendrier', label: 'Calendrier', icon: Calendar },
  { id: 'taches', label: 'Mes tâches', icon: CheckSquare },
  { id: 'contacts', label: 'Contacts', icon: Contact },
  { id: 'devis', label: 'Devis', icon: FileText },
  { id: 'factures', label: 'Factures', icon: Receipt },
  { id: 'prestations', label: 'Mes prestations', icon: Package },
  { id: 'chantiers', label: 'Chantiers', icon: HardHat },
  { id: 'planning', label: 'Planning', icon: CalendarDays },
  { id: 'carte', label: 'Carte', icon: MapPin },
  { id: 'equipe', label: 'Équipe', icon: UsersRound },
  { id: 'catalogues', label: 'Catalogues', icon: BookOpen },
  { id: 'prospection', label: 'Prospection', icon: Target },
  { id: 'site-web', label: 'Site web IA', icon: Globe },
  { id: 'mail', label: 'Boîte mail', icon: Mail },
  { id: 'avis', label: 'Avis Google', icon: Star },
  { id: 'plans-rendus', label: 'Plans & Rendus IA', icon: Paintbrush },
  { id: 'agents', label: 'Mes Agents', icon: Bot },
  { id: 'paiements', label: 'Paiement Stripe', icon: CreditCard },
  { id: 'contrats', label: 'Contrats récurrents', icon: RefreshCw },
  { id: 'comptabilite', label: 'Comptabilité IA', icon: Calculator },
];

export function DemoApp() {
  const [active, setActive] = useState('dashboard');

  return (
    <section id="demo" className="py-12 sm:py-24 bg-[var(--landing-white)]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
            Explorez <em className="italic text-[var(--landing-accent)]">l&apos;application</em>
          </h2>
          <p className="text-[var(--landing-muted)] text-lg max-w-xl mx-auto">
            Naviguez dans les principales vues de Hellobat pour comprendre comment devis, chantier, commercial et finance s&apos;enchaînent vraiment.
          </p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-[var(--landing-border)] bg-white shadow-2xl shadow-black/5 overflow-hidden">
          <div className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 border-b border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[10px] sm:text-xs text-[var(--landing-muted)] ml-2 sm:ml-3 font-mono">hellobat.app</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Google connecté
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:min-h-[500px]">
            <aside className="w-[200px] shrink-0 border-r border-[var(--landing-border)] bg-[var(--landing-off)] p-3 space-y-0.5 hidden md:block">
              <div className="flex items-center gap-2 px-3 py-2 mb-3">
                <div className="w-6 h-6 bg-[var(--landing-accent)] rounded-md flex items-center justify-center">
                  <Hexagon className="h-3 w-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-[var(--landing-text)]">Hellobat</span>
              </div>
              {views.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setActive(v.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    active === v.id
                      ? 'bg-[var(--landing-accent)] text-white'
                      : 'text-[var(--landing-muted)] hover:bg-[var(--landing-stone)] hover:text-[var(--landing-text)]'
                  }`}
                >
                  <v.icon className="w-3.5 h-3.5" />
                  {v.label}
                </button>
              ))}
            </aside>

            <div className="md:hidden px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-off)] overflow-x-auto">
              <div className="flex gap-1 w-max">
                {views.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setActive(v.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
                      active === v.id
                        ? 'bg-[var(--landing-accent)] text-white'
                        : 'bg-white text-[var(--landing-muted)] border border-[var(--landing-border)]'
                    }`}
                  >
                    <v.icon className="w-3 h-3" />
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

function DemoViewContent({ view }: { view: string }) {
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
    case 'chantiers':
      return <ChantiersView />;
    case 'planning':
      return <PlanningView />;
    case 'carte':
      return <CarteView />;
    case 'equipe':
      return <ÉquipeView />;
    case 'catalogues':
      return <CataloguesView />;
    case 'site-web':
      return <SiteWebView />;
    case 'prospection':
      return <ProspectionView />;
    case 'mail':
      return <EmailsView />;
    case 'avis':
      return <AvisView />;
    case 'plans-rendus':
      return <PlansView />;
    case 'paiements':
      return <PaiementView />;
    case 'contrats':
      return <ContratsView />;
    case 'agents':
      return <AgentsView />;
    case 'comptabilite':
      return <ComptaView />;
    default:
      return null;
  }
}

function ViewHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-[var(--landing-text)]">{title}</h3>
        {count !== undefined && <span className="text-xs text-[var(--landing-muted)]">{count} elements</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--landing-border)] bg-white">
          <Search className="w-3.5 h-3.5 text-[var(--landing-muted)]" />
          <span className="text-[11px] text-[var(--landing-muted)]">Rechercher...</span>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--landing-accent)] text-white text-[11px] font-medium">
          <Plus className="w-3 h-3" />
          Nouveau
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ label, variant }: { label: string; variant: 'success' | 'warning' | 'info' | 'danger' | 'muted' }) {
  const styles = {
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
    danger: 'bg-red-100 text-red-700',
    muted: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[variant]}`}>{label}</span>
  );
}

/* ─── DASHBOARD ─── */
function DashboardView() {
  const cards = [
    { label: 'CA encaissé', value: '38 400 EUR', helper: '+18% vs mois dernier', positive: true },
    { label: 'MRR Contrats', value: '4 200 EUR', helper: '12 contrats actifs', positive: true },
    { label: 'Devis en cours', value: '9', helper: '5 envoyés · 4 brouillons', positive: false },
    { label: 'Paiements Stripe', value: '26 800 EUR', helper: '96% encaissé', positive: true },
  ];

  return (
    <div>
      <ViewHeader title="Tableau de bord" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-3">
            <div className="text-[10px] font-medium text-[var(--landing-muted)] uppercase tracking-wide">{card.label}</div>
            <div className="mt-2 text-lg font-bold text-[var(--landing-text)]">{card.value}</div>
            <div className={`text-[10px] mt-1 font-medium ${card.positive ? 'text-emerald-600' : 'text-[var(--landing-muted)]'}`}>{card.helper}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
        {/* Graphique business */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-[var(--landing-text)]">Dynamique business</p>
              <p className="text-[10px] text-[var(--landing-muted)]">Devis, factures et encaissements</p>
            </div>
            <BarChart3 className="w-4 h-4 text-[var(--landing-muted)]" />
          </div>
          <div className="flex items-end gap-[3px] h-[70px]">
            {[28, 35, 42, 38, 55, 48, 62, 58, 72, 68, 85, 92].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col gap-[2px] items-stretch justify-end h-full">
                <div className="rounded-sm bg-[var(--landing-accent)]/20" style={{ height: `${h * 0.4}%` }} />
                <div className="rounded-sm bg-[var(--landing-accent)]/50" style={{ height: `${h * 0.3}%` }} />
                <div className="rounded-sm bg-[var(--landing-accent)]" style={{ height: `${h}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => (
              <span key={i} className="text-[8px] text-[var(--landing-muted)] flex-1 text-center">{m}</span>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {/* Google integrations */}
          <div className="rounded-xl border border-[var(--landing-border)] bg-white p-4">
            <p className="text-xs font-semibold text-[var(--landing-text)] mb-2">Connecté à Google</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                  <Calendar className="w-3 h-3 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-[var(--landing-text)]">Google Calendar</p>
                  <p className="text-[9px] text-[var(--landing-muted)]">3 RDV aujourd&apos;hui</p>
                </div>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center">
                  <Mail className="w-3 h-3 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-[var(--landing-text)]">Gmail</p>
                  <p className="text-[9px] text-[var(--landing-muted)]">2 non lus</p>
                </div>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              </div>
            </div>
          </div>

          {/* Rappels */}
          <div className="rounded-xl border border-[var(--landing-border)] bg-white p-4">
            <p className="text-xs font-semibold text-[var(--landing-text)] mb-2">Rappels</p>
            <div className="space-y-1.5">
              {[
                { icon: RefreshCw, label: 'Contrat Dupont — facturation', badge: 'Demain', color: 'text-amber-600' },
                { icon: FileText, label: 'Devis D-2026-042 à relancer', badge: '3 jours', color: 'text-blue-600' },
                { icon: HardHat, label: 'Chantier Moreau — démarrage', badge: 'Lundi', color: 'text-emerald-600' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <item.icon className={`w-3 h-3 ${item.color} shrink-0`} />
                  <span className="text-[10px] text-[var(--landing-text)] truncate flex-1">{item.label}</span>
                  <span className="text-[9px] text-[var(--landing-muted)] shrink-0">{item.badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CALENDRIER ─── */
function CalendrierView() {
  const days = ['Lun 31', 'Mar 1', 'Mer 2', 'Jeu 3', 'Ven 4'];
  const events = [
    { day: 0, top: '10%', height: '25%', label: 'RDV M. Dupont', color: 'bg-blue-100 border-blue-300 text-blue-700', google: true },
    { day: 1, top: '20%', height: '30%', label: 'Chantier Bernard', color: 'bg-[var(--landing-accent)]/10 border-[var(--landing-accent)]/30 text-[var(--landing-accent)]', google: false },
    { day: 2, top: '5%', height: '20%', label: 'Réunion équipe', color: 'bg-purple-100 border-purple-300 text-purple-700', google: true },
    { day: 3, top: '40%', height: '25%', label: 'Visite technique', color: 'bg-emerald-100 border-emerald-300 text-emerald-700', google: false },
    { day: 4, top: '15%', height: '20%', label: 'Devis Leroy', color: 'bg-amber-100 border-amber-300 text-amber-700', google: true },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-[var(--landing-text)]">Calendrier</h3>
          <span className="text-xs text-[var(--landing-muted)]">Semaine 14 — Mars 2026</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Google Calendar synchronisé
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {days.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-[var(--landing-muted)] uppercase tracking-wider pb-2">{d}</div>
        ))}
        {days.map((d, i) => (
          <div key={d} className="relative h-[200px] border border-[var(--landing-border)] rounded-lg bg-[var(--landing-off)]">
            {events.filter(e => e.day === i).map((ev) => (
              <div key={ev.label} className={`absolute left-1 right-1 rounded-md border p-1.5 ${ev.color}`} style={{ top: ev.top, height: ev.height }}>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-medium truncate">{ev.label}</span>
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

/* ─── TACHES ─── */
function TachesView() {
  const tasks = [
    { label: 'Relancer DEV-2026-042', done: false, due: 'Aujourd&apos;hui', cat: 'Devis' },
    { label: 'Commander faïence chantier Dupont', done: false, due: 'Demain', cat: 'Chantier' },
    { label: 'Envoyér facture Bernard', done: true, due: 'Fait', cat: 'Facture' },
    { label: 'Verifier photos chantier Martin', done: false, due: 'Cette semaine', cat: 'Chantier' },
  ];

  return (
    <div>
      <ViewHeader title="Mes tâches" count={tasks.length} />
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.label} className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] px-4 py-3">
            <div className={`flex h-5 w-5 items-center justify-center rounded-md border ${task.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[var(--landing-border)] bg-white'}`}>
              {task.done ? <CheckSquare className="h-3 w-3" /> : null}
            </div>
            <div className="flex-1">
              <div className={`text-xs font-medium ${task.done ? 'text-[var(--landing-muted)] line-through' : 'text-[var(--landing-text)]'}`}>
                {task.label}
              </div>
              <div className="text-[10px] text-[var(--landing-muted)]">{task.due}</div>
            </div>
            {!task.done ? <StatusBadge label="À faire" variant="warning" /> : <StatusBadge label="Terminée" variant="success" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── CONTACTS ─── */
function ContactsView() {
  const contacts = [
    { name: 'Mme Bernard', type: 'Client', city: 'Lyon', status: 'Chantier signé', variant: 'success' as const },
    { name: 'SCI Martin', type: 'Prospect', city: 'Marseille', status: 'Devis envoyé', variant: 'info' as const },
    { name: 'Fournisseur Pro', type: 'Prestataire', city: 'Paris', status: 'Actif', variant: 'muted' as const },
    { name: 'M. Dupont', type: 'Client', city: 'Paris', status: 'À relancer', variant: 'warning' as const },
  ];

  return (
    <div>
      <ViewHeader title="Contacts" count={contacts.length} />
      <div className="space-y-2">
        {contacts.map((contact) => (
          <div key={contact.name} className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[var(--landing-accent)]">
              <Contact className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-[var(--landing-text)]">{contact.name}</div>
              <div className="text-[10px] text-[var(--landing-muted)]">{contact.type} - {contact.city}</div>
            </div>
            <StatusBadge label={contact.status} variant={contact.variant} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DEVIS ─── */
function DevisView() {
  const devis = [
    { num: 'D-2026-042', client: 'M. Dupont', objet: 'Rénovation salle de bain', montant: '8 500 EUR', status: 'Envoyé', variant: 'info' as const, recurring: false, signed: false },
    { num: 'D-2026-041', client: 'Mme Bernard', objet: 'Entretien chaudière annuel', montant: '420 EUR/mois', status: 'Signé', variant: 'success' as const, recurring: true, signed: true },
    { num: 'D-2026-040', client: 'SCI Martin', objet: 'Réfection toiture terrasse', montant: '15 800 EUR', status: 'Brouillon', variant: 'muted' as const, recurring: false, signed: false },
    { num: 'D-2026-039', client: 'M. Leroy', objet: 'Plomberie complété', montant: '6 300 EUR', status: 'Refusé', variant: 'danger' as const, recurring: false, signed: false },
    { num: 'D-2026-038', client: 'Mme Petit', objet: 'Maintenance clim trimestrielle', montant: '350 EUR/trim.', status: 'Signé', variant: 'success' as const, recurring: true, signed: true },
  ];

  return (
    <div>
      <ViewHeader title="Devis" count={devis.length} />
      <div className="hidden sm:block border border-[var(--landing-border)] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--landing-off)] text-[10px] font-medium text-[var(--landing-muted)] uppercase tracking-wider">
              <th className="px-4 py-3">Numero</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3 hidden md:table-cell">Objet</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {devis.map((d) => (
              <tr key={d.num} className="border-t border-[var(--landing-border)] hover:bg-[var(--landing-off)]/50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-[var(--landing-accent)]">{d.num}</td>
                <td className="px-4 py-3 text-xs font-medium text-[var(--landing-text)]">
                  <div className="flex items-center gap-1.5">
                    {d.client}
                    {d.recurring && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        <RefreshCw className="w-2 h-2" /> Contrat
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--landing-muted)] hidden md:table-cell">{d.objet}</td>
                <td className="px-4 py-3 text-xs font-semibold text-[var(--landing-text)] text-right">{d.montant}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge label={d.status} variant={d.variant} />
                    {d.signed && <PenLine className="w-3 h-3 text-emerald-500" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-2">
        {devis.map((d) => (
          <div key={d.num} className="p-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[var(--landing-accent)]">{d.num}</span>
                {d.recurring && (
                  <span className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    <RefreshCw className="w-2 h-2" /> Contrat
                  </span>
                )}
                {d.signed && <PenLine className="w-3 h-3 text-emerald-500" />}
              </div>
              <StatusBadge label={d.status} variant={d.variant} />
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

/* ─── FACTURES ─── */
function FacturesView() {
  const invoices = [
    { num: 'F-2026-018', client: 'Mme Bernard', montant: '4 200 EUR', status: 'Envoyée', variant: 'info' as const, source: null },
    { num: 'F-2026-017', client: 'M. Dupont', montant: '8 500 EUR', status: 'Payée', variant: 'success' as const, source: null },
    { num: 'F-2026-016', client: 'SCI Martin', montant: '15 800 EUR', status: 'En retard', variant: 'danger' as const, source: null },
    { num: 'F-2026-015', client: 'M. Dupont', montant: '420 EUR', status: 'Payée', variant: 'success' as const, source: 'contrat' },
    { num: 'F-2026-014', client: 'Mme Petit', montant: '350 EUR', status: 'Envoyée', variant: 'info' as const, source: 'contrat' },
  ];

  return (
    <div>
      <ViewHeader title="Factures" count={invoices.length} />
      <div className="space-y-2">
        {invoices.map((invoice) => (
          <div key={invoice.num} className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] px-4 py-3">
            <div className="min-w-[82px] text-[10px] font-mono text-[var(--landing-accent)]">{invoice.num}</div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--landing-text)]">{invoice.client}</span>
                {invoice.source === 'contrat' && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    <RefreshCw className="w-2 h-2" /> Contrat
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[var(--landing-muted)]">{invoice.montant}</div>
            </div>
            <StatusBadge label={invoice.status} variant={invoice.variant} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PRESTATIONS ─── */
function PrestationsView() {
  const services = [
    { name: 'Dépose carrelage', unit: 'm2', price: '35 EUR', cat: 'Démolition', recurring: false },
    { name: 'Pose faïence murale', unit: 'm2', price: '55 EUR', cat: 'Carrelage', recurring: false },
    { name: 'Entretien chaudière gaz', unit: 'unite', price: '180 EUR', cat: 'Maintenance', recurring: true, freq: '/an' },
    { name: 'Maintenance climatisation', unit: 'unite', price: '120 EUR', cat: 'Maintenance', recurring: true, freq: '/trim.' },
    { name: 'Remplacement robinetterie', unit: 'unite', price: '95 EUR', cat: 'Plomberie', recurring: false },
    { name: 'Entretien piscine', unit: 'unite', price: '250 EUR', cat: 'Maintenance', recurring: true, freq: '/mois' },
  ];

  return (
    <div>
      <ViewHeader title="Mes prestations" count={services.length} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Total</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">24</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Catégories</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">6</div>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-[10px] text-emerald-600 font-medium">Récurrentes</div>
          <div className="text-lg font-bold text-emerald-700">3</div>
        </div>
      </div>

      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.name} className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
              <Package className="h-4 w-4 text-[var(--landing-accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-[var(--landing-text)] truncate">{s.name}</span>
                {s.recurring && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
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

/* ─── CHANTIERS ─── */
function ChantiersView() {
  const chantiers = [
    { name: 'Rénovation Dupont', address: '12 rue des Lilas, Paris', progress: 75, status: 'En cours', variant: 'info' as const },
    { name: 'Clim Bernard', address: '8 av. de la Gare, Lyon', progress: 30, status: 'En cours', variant: 'info' as const },
    { name: 'Toiture Martin', address: '45 bd Pasteur, Marseille', progress: 0, status: 'À planifier', variant: 'muted' as const },
    { name: 'Plomberie Leroy', address: '3 rue Victor Hugo, Lille', progress: 100, status: 'Terminé', variant: 'success' as const },
  ];

  return (
    <div>
      <ViewHeader title="Chantiers" count={chantiers.length} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {chantiers.map((c) => (
          <div key={c.name} className="p-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-[var(--landing-text)]">{c.name}</h4>
                <p className="text-[10px] text-[var(--landing-muted)]">{c.address}</p>
              </div>
              <StatusBadge label={c.status} variant={c.variant} />
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--landing-border)]">
              <div
                className="h-full rounded-full bg-[var(--landing-accent)] transition-all"
                style={{ width: `${c.progress}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--landing-muted)] mt-1 block">{c.progress}% complété</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PLANNING ─── */
function PlanningView() {
  const events = [
    { name: 'Dupont - Rénovation SdB', time: '08:00 - 12:00', color: 'bg-[var(--landing-accent)]', day: 'Lun 24' },
    { name: 'Bernard - Clim', time: '09:00 - 11:00', color: 'bg-blue-500', day: 'Mar 25' },
    { name: 'Martin - Toiture', time: '10:00 - 14:00', color: 'bg-emerald-500', day: 'Mer 26' },
    { name: 'Leroy - Plomberie', time: '14:00 - 17:00', color: 'bg-amber-500', day: 'Jeu 27' },
  ];

  return (
    <div>
      <ViewHeader title="Planning" />
      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.name} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className={`w-1 h-10 rounded-full ${ev.color}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--landing-text)] truncate">{ev.name}</div>
              <div className="text-[10px] text-[var(--landing-muted)]">{ev.day} | {ev.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── EQUIPE ─── */
function ÉquipeView() {
  const team = [
    { name: 'Lucas', role: 'Salarié', hours: '34 h cette semaine', project: 'Rénovation Dupont' },
    { name: 'Sarah', role: 'Sous-traitante', hours: '18 h cette semaine', project: 'Clim Bernard' },
    { name: 'Mehdi', role: 'Intérimaire', hours: '26 h cette semaine', project: 'Toiture Martin' },
  ];

  return (
    <div>
      <ViewHeader title="Équipe" count={team.length} />
      <div className="space-y-3">
        {team.map((member) => (
          <div key={member.name} className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
              <UsersRound className="h-4 w-4 text-[var(--landing-accent)]" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-[var(--landing-text)]">{member.name}</div>
              <div className="text-[10px] text-[var(--landing-muted)]">{member.role} - {member.project}</div>
            </div>
            <span className="text-[10px] font-medium text-[var(--landing-text)]">{member.hours}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── CARTE ─── */
function CarteView() {
  return (
    <div>
      <ViewHeader title="Carte des chantiers" />
      <div className="h-[260px] sm:h-[380px] rounded-xl bg-[#e8e4da] relative overflow-hidden border border-[var(--landing-border)]">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, #bbb 30px, #bbb 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, #bbb 30px, #bbb 31px)' }} />
        {[
          { top: '15%', left: '25%', color: 'bg-emerald-500', label: 'Dupont' },
          { top: '35%', left: '55%', color: 'bg-[var(--landing-accent)]', label: 'Bernard' },
          { top: '55%', left: '20%', color: 'bg-blue-500', label: 'Martin' },
          { top: '25%', left: '70%', color: 'bg-amber-500', label: 'Leroy' },
          { top: '65%', left: '60%', color: 'bg-emerald-500', label: 'Petit' },
        ].map((pin) => (
          <div key={pin.label} className="absolute group" style={{ top: pin.top, left: pin.left }}>
            <div className={`w-5 h-5 rounded-full ${pin.color} border-2 border-white shadow-lg cursor-pointer`} />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-white rounded-md shadow-md text-[9px] font-medium text-[var(--landing-text)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {pin.label}
            </div>
          </div>
        ))}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1 sm:gap-2">
          {['Tous', 'En cours', 'Terminés', 'Prospects'].map((f) => (
            <button key={f} className="px-2 py-1 rounded-md bg-white/90 text-[8px] sm:text-[9px] font-medium text-[var(--landing-text)] shadow-sm border border-[var(--landing-border)]">
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── SITE WEB ─── */
function SiteWebView() {
  return (
    <div>
      <ViewHeader title="Site Web" />
      <div className="rounded-xl border border-[var(--landing-border)] overflow-hidden">
        <div className="h-40 bg-gradient-to-br from-[var(--landing-stone)] to-[var(--landing-border)] flex items-center justify-center">
          <div className="text-center">
            <h4 className="text-xl font-serif text-[var(--landing-text)]">Martin Plomberie</h4>
            <p className="text-xs text-[var(--landing-muted)]">Votre plombier de confiance a Lyon</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-video rounded-lg bg-[var(--landing-stone)]" />
            ))}
          </div>
          <div className="flex gap-2">
            <button className="flex-1 py-2 rounded-lg bg-[var(--landing-accent)] text-white text-xs font-medium">Demander un devis</button>
            <button className="flex-1 py-2 rounded-lg border border-[var(--landing-border)] text-xs text-[var(--landing-text)]">Voir nos réalisations</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CATALOGUES ─── */
function CataloguesView() {
  const catalogs = [
    { name: 'Salle de bain premium', items: 18, status: 'Partagé', variant: 'success' as const },
    { name: 'Chauffage & chaudière', items: 12, status: 'Prêt', variant: 'info' as const },
    { name: 'Climatisation mono-split', items: 9, status: 'Brouillon', variant: 'muted' as const },
  ];

  return (
    <div>
      <ViewHeader title="Catalogues" count={catalogs.length} />
      <div className="grid gap-3 sm:grid-cols-3">
        {catalogs.map((catalog) => (
          <div key={catalog.name} className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white">
              <BookOpen className="h-4 w-4 text-[var(--landing-accent)]" />
            </div>
            <div className="text-xs font-semibold text-[var(--landing-text)]">{catalog.name}</div>
            <div className="mt-1 text-[10px] text-[var(--landing-muted)]">{catalog.items} produits</div>
            <div className="mt-3">
              <StatusBadge label={catalog.status} variant={catalog.variant} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PROSPECTION CRM ─── */
function ProspectionView() {
  const columns = [
    { title: 'Nouveau', count: 3, color: 'bg-gray-400' },
    { title: 'Contacté', count: 2, color: 'bg-blue-400' },
    { title: 'Devis envoyé', count: 4, color: 'bg-amber-400' },
    { title: 'Gagné', count: 2, color: 'bg-emerald-400' },
  ];

  return (
    <div>
      <ViewHeader title="Prospection CRM" count={11} />
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {columns.map((col) => (
          <div key={col.title} className="min-w-[140px] sm:min-w-[160px] flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${col.color}`} />
              <span className="text-[10px] font-semibold text-[var(--landing-text)] uppercase tracking-wider">{col.title}</span>
              <span className="text-[10px] text-[var(--landing-muted)] ml-auto">{col.count}</span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: col.count }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)] hover:shadow-sm transition-shadow">
                  <div className="h-2.5 w-20 rounded bg-[var(--landing-border)] mb-2" />
                  <div className="h-2 w-14 rounded bg-[var(--landing-stone)]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── EMAILS (GMAIL) ─── */
function EmailsView() {
  const emails = [
    { from: 'M. Dupont', subject: 'Re: Devis salle de bain', preview: 'Bonjour, le devis me convient...', time: '10:32', unread: true },
    { from: 'Mme Bernard', subject: 'Demande de devis toiture', preview: 'Suite à notre conversation...', time: '09:15', unread: true },
    { from: 'SAS Martin', subject: 'Commande matériaux confirmée', preview: 'Votre commande a été...', time: 'Hier', unread: false },
    { from: 'M. Leroy', subject: 'Facture réglée', preview: 'Merci pour votre travail...', time: 'Hier', unread: false },
    { from: 'Fournisseur Pro', subject: 'Nouvelles références', preview: 'Découvrez notre catalogue...', time: 'Lun', unread: false },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-[var(--landing-text)]">Boîte mail</h3>
          <span className="text-xs text-[var(--landing-muted)]">{emails.length} messages</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Gmail synchronisé
          </span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--landing-accent)] text-white text-[11px] font-medium">
            <Send className="w-3 h-3" />
            Écrire
          </button>
        </div>
      </div>

      <div className="border border-[var(--landing-border)] rounded-xl overflow-hidden divide-y divide-[var(--landing-border)]">
        {emails.map((e) => (
          <div key={e.subject} className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--landing-off)] transition-colors cursor-pointer ${e.unread ? 'bg-[var(--landing-accent-light)]/30' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-[var(--landing-stone)] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-[var(--landing-muted)]">{e.from[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs ${e.unread ? 'font-bold' : 'font-medium'} text-[var(--landing-text)] truncate`}>{e.from}</span>
                {e.unread && <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)]" />}
              </div>
              <div className="text-[11px] text-[var(--landing-text)] truncate">{e.subject}</div>
              <div className="text-[10px] text-[var(--landing-muted)] truncate">{e.preview}</div>
            </div>
            <span className="text-[10px] text-[var(--landing-muted)] shrink-0">{e.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── AVIS GOOGLE ─── */
function AvisView() {
  const reviews = [
    { name: 'Pierre L.', text: 'Travail impeccable sur ma salle de bain. Équipe ponctuelle et soignée. Je recommande !', stars: 5, date: 'Il y a 2 jours' },
    { name: 'Sophie M.', text: 'Très professionnel. Le devis a été respecté à l\'euro près. Chantier propre.', stars: 5, date: 'Il y a 1 semaine' },
    { name: 'Jean D.', text: 'Bon travail dans l\'ensemble, petit retard au démarrage mais résultat conforme.', stars: 4, date: 'Il y a 2 semaines' },
  ];

  return (
    <div>
      <ViewHeader title="Avis Google" count={127} />
      <div className="flex items-center gap-6 p-4 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)] mb-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-[var(--landing-text)]">4.9</div>
          <div className="text-amber-500 text-sm">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
          <div className="text-[10px] text-[var(--landing-muted)]">127 avis</div>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--landing-muted)] w-3">{s}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--landing-border)]">
                <div className="h-full rounded-full bg-amber-400" style={{ width: s === 5 ? '85%' : s === 4 ? '12%' : '3%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.name} className="p-4 rounded-xl border border-[var(--landing-border)] bg-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-[var(--landing-stone)] flex items-center justify-center">
                <span className="text-[9px] font-bold text-[var(--landing-muted)]">{r.name[0]}</span>
              </div>
              <span className="text-xs font-semibold text-[var(--landing-text)]">{r.name}</span>
              <span className="text-amber-500 text-[10px]">{'★'.repeat(r.stars)}</span>
              <span className="text-[10px] text-[var(--landing-muted)] ml-auto">{r.date}</span>
            </div>
            <p className="text-xs text-[var(--landing-muted)] leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PLANS & RENDUS ─── */
function PlansView() {
  const files = [
    { name: 'Plan RDC.pdf', type: 'PDF', size: '2.4 MB' },
    { name: 'Facade avant.jpg', type: 'Image', size: '1.8 MB' },
    { name: 'Devis detaille.pdf', type: 'PDF', size: '450 KB' },
    { name: 'Photo chantier 1.jpg', type: 'Image', size: '3.1 MB' },
    { name: 'Rendu 3D salon.png', type: 'Image', size: '5.2 MB' },
    { name: 'Plan etage.pdf', type: 'PDF', size: '1.9 MB' },
  ];

  return (
    <div>
      <ViewHeader title="Plans & Documents" count={files.length} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {files.map((f) => (
          <div key={f.name} className="group p-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] hover:shadow-md transition-shadow cursor-pointer">
            <div className="aspect-square rounded-lg bg-[var(--landing-stone)] mb-3 flex items-center justify-center">
              <FileImage className="w-8 h-8 text-[var(--landing-muted)]" />
            </div>
            <div className="text-xs font-medium text-[var(--landing-text)] truncate">{f.name}</div>
            <div className="text-[10px] text-[var(--landing-muted)]">{f.type} - {f.size}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PAIEMENTS STRIPE ─── */
function PaiementView() {
  const payments = [
    { client: 'M. Dupont', montant: '8 500 EUR', date: '24 Mar 2026', status: 'Payé', variant: 'success' as const, method: 'Carte' },
    { client: 'Mme Bernard', montant: '4 200 EUR', date: '22 Mar 2026', status: 'Lien envoyé', variant: 'info' as const, method: 'Lien' },
    { client: 'SCI Martin', montant: '15 800 EUR', date: '20 Mar 2026', status: 'En retard', variant: 'danger' as const, method: 'Carte' },
    { client: 'M. Dupont', montant: '420 EUR', date: '1 Avr 2026', status: 'Payé', variant: 'success' as const, method: 'Auto' },
  ];

  return (
    <div>
      <ViewHeader title="Paiements Stripe" count={payments.length} />

      {/* Stripe Connect banner */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#635bff]/10 to-[#635bff]/5 border border-[#635bff]/20 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#635bff]/20 flex items-center justify-center">
          <CreditCard className="w-4 h-4 text-[#635bff]" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-[var(--landing-text)]">Stripe Connect actif</div>
          <div className="text-[10px] text-[var(--landing-muted)]">Commission plateforme : 1% · Paiement direct sur votre compte</div>
        </div>
        <CheckCircle2 className="w-4 h-4 text-[#635bff]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="p-3 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-[10px] text-emerald-600 font-medium mb-1">Encaissé</div>
          <div className="text-lg sm:text-xl font-bold text-emerald-700">24 720 EUR</div>
        </div>
        <div className="p-3 sm:p-4 rounded-xl bg-blue-50 border border-blue-200">
          <div className="text-[10px] text-blue-600 font-medium mb-1">Lien envoyé</div>
          <div className="text-lg sm:text-xl font-bold text-blue-700">4 200 EUR</div>
        </div>
        <div className="p-3 sm:p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="text-[10px] text-red-600 font-medium mb-1">En retard</div>
          <div className="text-lg sm:text-xl font-bold text-red-700">15 800 EUR</div>
        </div>
      </div>

      <div className="hidden sm:block border border-[var(--landing-border)] rounded-xl overflow-hidden">
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
                <td className="px-4 py-3 text-xs font-medium text-[var(--landing-text)]">{p.client}</td>
                <td className="px-4 py-3 text-xs font-semibold text-[var(--landing-text)] text-right">{p.montant}</td>
                <td className="px-4 py-3 text-[10px] text-[var(--landing-muted)]">{p.method}</td>
                <td className="px-4 py-3 text-xs text-[var(--landing-muted)]">{p.date}</td>
                <td className="px-4 py-3"><StatusBadge label={p.status} variant={p.variant} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-2">
        {payments.map((p, i) => (
          <div key={i} className="p-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-[var(--landing-text)]">{p.client}</span>
              <StatusBadge label={p.status} variant={p.variant} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--landing-muted)]">{p.date} · {p.method}</span>
              <span className="text-xs font-semibold text-[var(--landing-text)]">{p.montant}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── CONTRATS RECURRENTS ─── */
function ContratsView() {
  const contracts = [
    { type: 'Entretien chaudière', client: 'M. Dupont', montant: '420 EUR', freq: 'Annuel', next: '15 Jun 2026', tva: '10%', status: 'Actif', variant: 'success' as const, devis: 'D-2026-041' },
    { type: 'Maintenance clim', client: 'Mme Petit', montant: '350 EUR', freq: 'Trimestriel', next: '1 Jul 2026', tva: '20%', status: 'Actif', variant: 'success' as const, devis: 'D-2026-038' },
    { type: 'Entretien piscine', client: 'SCI Martin', montant: '250 EUR', freq: 'Mensuel', next: '1 Mai 2026', tva: '20%', status: 'Actif', variant: 'success' as const, devis: 'D-2026-035' },
    { type: 'Ramonage cheminee', client: 'Mme Bernard', montant: '180 EUR', freq: 'Annuel', next: '—', tva: '10%', status: 'En attente', variant: 'info' as const, devis: 'D-2026-044' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-[var(--landing-text)]">Contrats récurrents</h3>
          <span className="text-xs text-[var(--landing-muted)]">{contracts.length} contrats</span>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--landing-accent)] text-white text-[11px] font-medium">
          <Plus className="w-3 h-3" />
          Nouveau contrat
        </button>
      </div>

      {/* MRR / ARR KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-[10px] text-emerald-600 font-medium">MRR</div>
          <div className="text-lg font-bold text-emerald-700">4 200 EUR</div>
          <div className="text-[10px] text-emerald-600">+8% ce mois</div>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
          <div className="text-[10px] text-blue-600 font-medium">ARR</div>
          <div className="text-lg font-bold text-blue-700">50 400 EUR</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Contrats actifs</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">3</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Taux d&apos;encaissement</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">96%</div>
        </div>
      </div>

      {/* MRR mini chart */}
      <div className="rounded-xl border border-[var(--landing-border)] bg-white p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-[var(--landing-text)]">Évolution MRR</p>
            <p className="text-[10px] text-[var(--landing-muted)]">12 derniers mois</p>
          </div>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="flex items-end gap-1 h-[50px]">
          {[2200, 2200, 2600, 2600, 3100, 3100, 3500, 3500, 3800, 3800, 4200, 4200].map((v, i) => (
            <div key={i} className="flex-1 rounded-t-sm bg-emerald-400/60" style={{ height: `${(v / 4200) * 100}%` }} />
          ))}
        </div>
      </div>

      {/* Contracts list */}
      <div className="space-y-3">
        {contracts.map((c) => (
          <div key={c.client} className="p-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[var(--landing-accent)]" />
                <div>
                  <div className="text-xs font-semibold text-[var(--landing-text)]">{c.type} — {c.client}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[var(--landing-muted)]">{c.freq} · TVA {c.tva}</span>
                    <span className="text-[10px] text-[var(--landing-accent)] font-mono">{c.devis}</span>
                  </div>
                </div>
              </div>
              <StatusBadge label={c.status} variant={c.variant} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--landing-text)]">{c.montant}</span>
              <span className="text-[10px] text-[var(--landing-muted)]">Prochaine échéance : {c.next}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── AGENTS IA ─── */
function AgentsView() {
  return (
    <div>
      <ViewHeader title="Agents IA" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Agent Devis</span>
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-700">Actif</span>
          </div>
          <p className="text-[10px] text-emerald-600">Généré automatiquement des devis a partir des demandes client.</p>
        </div>
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">Agent Support</span>
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-blue-200 text-blue-700">Actif</span>
          </div>
          <p className="text-[10px] text-blue-600">Répond aux questions clients et planifie les rendez-vous.</p>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--landing-border)] p-4 space-y-3">
        <div className="text-xs font-medium text-[var(--landing-muted)] mb-2">Conversation récente</div>
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Bot className="w-3 h-3 text-emerald-600" />
          </div>
          <div className="p-2.5 rounded-xl rounded-tl-none bg-[var(--landing-off)] border border-[var(--landing-border)] text-[11px] text-[var(--landing-text)] max-w-[80%]">
            J&apos;ai analysé la demande de M. Dupont. Budget estimé : 8 500 EUR pour la renovation salle de bain. Voulez-vous que je génère le devis ?
          </div>
        </div>
        <div className="flex items-start gap-2 flex-row-reverse">
          <div className="w-6 h-6 rounded-full bg-[var(--landing-accent-light)] flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-[var(--landing-accent)]">V</span>
          </div>
          <div className="p-2.5 rounded-xl rounded-tr-none bg-[var(--landing-accent)] text-white text-[11px] max-w-[80%]">
            Oui, génère-le et envoie-le directement.
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Bot className="w-3 h-3 text-emerald-600" />
          </div>
          <div className="p-2.5 rounded-xl rounded-tl-none bg-[var(--landing-off)] border border-[var(--landing-border)] text-[11px] text-[var(--landing-text)] max-w-[80%]">
            Devis D-2026-047 génère et envoyé à dupont@email.fr. Le client sera notifié par email.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── COMPTABILITE ─── */
function ComptaView() {
  return (
    <div>
      <ViewHeader title="Comptabilité" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">CA annuel</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">148 200 EUR</div>
          <div className="text-[10px] text-emerald-600">+18% vs N-1</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Dépenses</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">52 400 EUR</div>
          <div className="text-[10px] text-red-500">+5% vs N-1</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Marge nette</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">64.6%</div>
          <div className="text-[10px] text-emerald-600">+3.2 pts</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Trésorerie</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">28 600 EUR</div>
          <div className="text-[10px] text-emerald-600">Sain</div>
        </div>
      </div>
      <div className="flex items-end gap-1 h-32 p-4 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
        {[35, 45, 60, 50, 75, 65, 80, 70, 90, 85, 70, 95].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-stretch gap-0.5">
            <div className="bg-[var(--landing-accent)] rounded-t-sm" style={{ height: `${h * 0.6}%` }} />
            <div className="bg-[var(--landing-accent)]/30 rounded-b-sm" style={{ height: `${h * 0.4}%` }} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[var(--landing-accent)]" />
          <span className="text-[10px] text-[var(--landing-muted)]">Revenus</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[var(--landing-accent)]/30" />
          <span className="text-[10px] text-[var(--landing-muted)]">Dépenses</span>
        </div>
      </div>
    </div>
  );
}
