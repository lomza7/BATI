'use client';

import { useState } from 'react';
import { FileText, HardHat, CalendarDays, MapPin, Globe, Target, Mail, Star, FileImage, CreditCard, Repeat, Bot, Calculator, TrendingUp, MoveHorizontal as MoreHorizontal, Search, Plus, Filter, Send } from 'lucide-react';

const views = [
  { id: 'devis', label: 'Devis', icon: FileText },
  { id: 'chantiers', label: 'Chantiers', icon: HardHat },
  { id: 'planning', label: 'Planning', icon: CalendarDays },
  { id: 'carte', label: 'Carte', icon: MapPin },
  { id: 'siteweb', label: 'Site Web', icon: Globe },
  { id: 'prospection', label: 'Prospection', icon: Target },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'avis', label: 'Avis', icon: Star },
  { id: 'plans', label: 'Plans', icon: FileImage },
  { id: 'paiement', label: 'Paiements', icon: CreditCard },
  { id: 'abonnements', label: 'Contrats', icon: Repeat },
  { id: 'agents', label: 'Agents IA', icon: Bot },
  { id: 'compta', label: 'Compta', icon: Calculator },
];

export function DemoApp() {
  const [active, setActive] = useState('devis');

  return (
    <section id="demo" className="py-12 sm:py-24 bg-[var(--landing-white)]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
            Explorez <em className="italic text-[var(--landing-accent)]">l&apos;application</em>
          </h2>
          <p className="text-[var(--landing-muted)] text-lg max-w-xl mx-auto">
            Naviguez entre les 13 modules pour decouvrir toutes les fonctionnalites de BatiFlow.
          </p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-[var(--landing-border)] bg-white shadow-2xl shadow-black/5 overflow-hidden">
          <div className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 border-b border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[10px] sm:text-xs text-[var(--landing-muted)] ml-2 sm:ml-3 font-mono">app.batiflow.fr</span>
          </div>

          <div className="flex flex-col md:flex-row md:min-h-[500px]">
            <aside className="w-[200px] shrink-0 border-r border-[var(--landing-border)] bg-[var(--landing-off)] p-3 space-y-0.5 hidden md:block">
              <div className="flex items-center gap-2 px-3 py-2 mb-3">
                <div className="w-6 h-6 bg-[var(--landing-accent)] rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-[10px]">B</span>
                </div>
                <span className="text-xs font-semibold text-[var(--landing-text)]">BatiFlow</span>
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
    case 'devis':
      return <DevisView />;
    case 'chantiers':
      return <ChantiersView />;
    case 'planning':
      return <PlanningView />;
    case 'carte':
      return <CarteView />;
    case 'siteweb':
      return <SiteWebView />;
    case 'prospection':
      return <ProspectionView />;
    case 'emails':
      return <EmailsView />;
    case 'avis':
      return <AvisView />;
    case 'plans':
      return <PlansView />;
    case 'paiement':
      return <PaiementView />;
    case 'abonnements':
      return <AbonnementsView />;
    case 'agents':
      return <AgentsView />;
    case 'compta':
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

function DevisView() {
  const devis = [
    { num: 'DEV-2026-042', client: 'M. Dupont', objet: 'Renovation salle de bain', montant: '8 500 EUR', status: 'Envoye', variant: 'info' as const },
    { num: 'DEV-2026-041', client: 'Mme Bernard', objet: 'Installation climatisation', montant: '4 200 EUR', status: 'Accepte', variant: 'success' as const },
    { num: 'DEV-2026-040', client: 'SCI Martin', objet: 'Refection toiture terrasse', montant: '15 800 EUR', status: 'Brouillon', variant: 'muted' as const },
    { num: 'DEV-2026-039', client: 'M. Leroy', objet: 'Plomberie complete', montant: '6 300 EUR', status: 'Refuse', variant: 'danger' as const },
    { num: 'DEV-2026-038', client: 'Mme Petit', objet: 'Carrelage cuisine', montant: '3 100 EUR', status: 'Accepte', variant: 'success' as const },
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
                <td className="px-4 py-3 text-xs font-medium text-[var(--landing-text)]">{d.client}</td>
                <td className="px-4 py-3 text-xs text-[var(--landing-muted)] hidden md:table-cell">{d.objet}</td>
                <td className="px-4 py-3 text-xs font-semibold text-[var(--landing-text)] text-right">{d.montant}</td>
                <td className="px-4 py-3"><StatusBadge label={d.status} variant={d.variant} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-2">
        {devis.map((d) => (
          <div key={d.num} className="p-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-[var(--landing-accent)]">{d.num}</span>
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

function ChantiersView() {
  const chantiers = [
    { name: 'Renovation Dupont', address: '12 rue des Lilas, Paris', progress: 75, status: 'En cours', variant: 'info' as const },
    { name: 'Clim Bernard', address: '8 av. de la Gare, Lyon', progress: 30, status: 'En cours', variant: 'info' as const },
    { name: 'Toiture Martin', address: '45 bd Pasteur, Marseille', progress: 0, status: 'A planifier', variant: 'muted' as const },
    { name: 'Plomberie Leroy', address: '3 rue Victor Hugo, Lille', progress: 100, status: 'Termine', variant: 'success' as const },
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
            <span className="text-[10px] text-[var(--landing-muted)] mt-1 block">{c.progress}% complete</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanningView() {
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  const events = [
    { name: 'Dupont - Renovation SdB', time: '08:00 - 12:00', color: 'bg-[var(--landing-accent)]', day: 'Lun 24' },
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
          {['Tous', 'En cours', 'Termines', 'Prospects'].map((f) => (
            <button key={f} className="px-2 py-1 rounded-md bg-white/90 text-[8px] sm:text-[9px] font-medium text-[var(--landing-text)] shadow-sm border border-[var(--landing-border)]">
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
            <button className="flex-1 py-2 rounded-lg border border-[var(--landing-border)] text-xs text-[var(--landing-text)]">Voir nos realisations</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProspectionView() {
  const columns = [
    { title: 'Nouveau', count: 3, color: 'bg-gray-400' },
    { title: 'Contacte', count: 2, color: 'bg-blue-400' },
    { title: 'Devis envoye', count: 4, color: 'bg-amber-400' },
    { title: 'Gagne', count: 2, color: 'bg-emerald-400' },
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

function EmailsView() {
  const emails = [
    { from: 'M. Dupont', subject: 'Re: Devis salle de bain', preview: 'Bonjour, le devis me convient...', time: '10:32', unread: true },
    { from: 'Mme Bernard', subject: 'Demande de devis toiture', preview: 'Suite a notre conversation...', time: '09:15', unread: true },
    { from: 'SAS Martin', subject: 'Commande materiaux confirmee', preview: 'Votre commande a ete...', time: 'Hier', unread: false },
    { from: 'M. Leroy', subject: 'Facture reglee', preview: 'Merci pour votre travail...', time: 'Hier', unread: false },
    { from: 'Fournisseur Pro', subject: 'Nouvelles references', preview: 'Decouvrez notre catalogue...', time: 'Lun', unread: false },
  ];

  return (
    <div>
      <ViewHeader title="Messagerie" count={emails.length} />
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

function AvisView() {
  const reviews = [
    { name: 'Pierre L.', text: 'Travail impeccable sur ma salle de bain. Equipe ponctuelle et soignee. Je recommande !', stars: 5, date: 'Il y a 2 jours' },
    { name: 'Sophie M.', text: 'Tres professionnel. Le devis a ete respecte a l\'euro pres. Chantier propre.', stars: 5, date: 'Il y a 1 semaine' },
    { name: 'Jean D.', text: 'Bon travail dans l\'ensemble, petit retard au demarrage mais resultat conforme.', stars: 4, date: 'Il y a 2 semaines' },
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

function PaiementView() {
  const payments = [
    { client: 'M. Dupont', montant: '8 500 EUR', date: '24 Mar 2026', status: 'Paye', variant: 'success' as const },
    { client: 'Mme Bernard', montant: '4 200 EUR', date: '22 Mar 2026', status: 'En attente', variant: 'warning' as const },
    { client: 'SCI Martin', montant: '15 800 EUR', date: '20 Mar 2026', status: 'En retard', variant: 'danger' as const },
    { client: 'M. Leroy', montant: '6 300 EUR', date: '18 Mar 2026', status: 'Paye', variant: 'success' as const },
  ];

  return (
    <div>
      <ViewHeader title="Paiements" count={payments.length} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="p-3 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-[10px] text-emerald-600 font-medium mb-1">Encaisse</div>
          <div className="text-lg sm:text-xl font-bold text-emerald-700">14 800 EUR</div>
        </div>
        <div className="p-3 sm:p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="text-[10px] text-amber-600 font-medium mb-1">En attente</div>
          <div className="text-lg sm:text-xl font-bold text-amber-700">4 200 EUR</div>
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
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.client + p.date} className="border-t border-[var(--landing-border)]">
                <td className="px-4 py-3 text-xs font-medium text-[var(--landing-text)]">{p.client}</td>
                <td className="px-4 py-3 text-xs font-semibold text-[var(--landing-text)] text-right">{p.montant}</td>
                <td className="px-4 py-3 text-xs text-[var(--landing-muted)]">{p.date}</td>
                <td className="px-4 py-3"><StatusBadge label={p.status} variant={p.variant} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-2">
        {payments.map((p) => (
          <div key={p.client + p.date} className="p-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-[var(--landing-text)]">{p.client}</span>
              <StatusBadge label={p.status} variant={p.variant} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--landing-muted)]">{p.date}</span>
              <span className="text-xs font-semibold text-[var(--landing-text)]">{p.montant}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AbonnementsView() {
  const contracts = [
    { type: 'Chaudiere', client: 'M. Dupont', next: '15 Jan 2026', status: 'Actif', variant: 'success' as const },
    { type: 'Climatisation', client: 'Mme Bernard', next: '28 Fev 2026', status: 'A renouveler', variant: 'warning' as const },
    { type: 'Piscine', client: 'SCI Martin', next: '10 Avr 2026', status: 'Actif', variant: 'success' as const },
    { type: 'Chaudiere', client: 'M. Petit', next: '22 Mai 2026', status: 'Actif', variant: 'success' as const },
  ];

  return (
    <div>
      <ViewHeader title="Contrats de maintenance" count={contracts.length} />
      <div className="space-y-3">
        {contracts.map((c) => (
          <div key={c.client} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] hover:shadow-sm transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-[var(--landing-stone)] flex items-center justify-center">
              <Repeat className="w-4 h-4 text-[var(--landing-accent)]" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-[var(--landing-text)]">{c.type} - {c.client}</div>
              <div className="text-[10px] text-[var(--landing-muted)]">Prochaine echeance : {c.next}</div>
            </div>
            <StatusBadge label={c.status} variant={c.variant} />
          </div>
        ))}
      </div>
    </div>
  );
}

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
          <p className="text-[10px] text-emerald-600">Genere automatiquement des devis a partir des demandes client.</p>
        </div>
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">Agent Support</span>
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-blue-200 text-blue-700">Actif</span>
          </div>
          <p className="text-[10px] text-blue-600">Repond aux questions clients et planifie les rendez-vous.</p>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--landing-border)] p-4 space-y-3">
        <div className="text-xs font-medium text-[var(--landing-muted)] mb-2">Conversation recente</div>
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Bot className="w-3 h-3 text-emerald-600" />
          </div>
          <div className="p-2.5 rounded-xl rounded-tl-none bg-[var(--landing-off)] border border-[var(--landing-border)] text-[11px] text-[var(--landing-text)] max-w-[80%]">
            J&apos;ai analyse la demande de M. Dupont. Budget estime : 8 500 EUR pour la renovation salle de bain. Voulez-vous que je genere le devis ?
          </div>
        </div>
        <div className="flex items-start gap-2 flex-row-reverse">
          <div className="w-6 h-6 rounded-full bg-[var(--landing-accent-light)] flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-[var(--landing-accent)]">V</span>
          </div>
          <div className="p-2.5 rounded-xl rounded-tr-none bg-[var(--landing-accent)] text-white text-[11px] max-w-[80%]">
            Oui, genere-le et envoie-le directement.
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Bot className="w-3 h-3 text-emerald-600" />
          </div>
          <div className="p-2.5 rounded-xl rounded-tl-none bg-[var(--landing-off)] border border-[var(--landing-border)] text-[11px] text-[var(--landing-text)] max-w-[80%]">
            Devis DEV-2026-047 genere et envoye a dupont@email.fr. Le client sera notifie par email.
          </div>
        </div>
      </div>
    </div>
  );
}

function ComptaView() {
  return (
    <div>
      <ViewHeader title="Comptabilite" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">CA annuel</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">148 200 EUR</div>
          <div className="text-[10px] text-emerald-600">+18% vs N-1</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Depenses</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">52 400 EUR</div>
          <div className="text-[10px] text-red-500">+5% vs N-1</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Marge nette</div>
          <div className="text-lg font-bold text-[var(--landing-text)]">64.6%</div>
          <div className="text-[10px] text-emerald-600">+3.2 pts</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
          <div className="text-[10px] text-[var(--landing-muted)] font-medium">Tresorerie</div>
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
          <span className="text-[10px] text-[var(--landing-muted)]">Depenses</span>
        </div>
      </div>
    </div>
  );
}
