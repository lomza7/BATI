import {
  FileText,
  HardHat,
  CalendarDays,
  MapPin,
  Globe,
  Target,
  Mail,
  Star,
  FileImage,
  CreditCard,
  Bot,
  Contact,
  UsersRound,
  BookOpen,
  Mic,
  Calendar,
  RefreshCw,
  Calculator,
  Package,
  PenLine,
} from 'lucide-react';

const items = [
  { icon: Mic, label: 'Devis IA vocal' },
  { icon: FileText, label: 'Devis & Factures' },
  { icon: PenLine, label: 'Signature électronique illimitée' },
  { icon: Package, label: 'Prestations récurrentes' },
  { icon: Contact, label: 'Carnet de contacts' },
  { icon: HardHat, label: 'Suivi chantiers' },
  { icon: CalendarDays, label: 'Planning drag & drop' },
  { icon: Calendar, label: 'Google Calendar' },
  { icon: UsersRound, label: 'Équipe & sous-traitants' },
  { icon: MapPin, label: 'Carte interactive' },
  { icon: BookOpen, label: 'Catalogues produits' },
  { icon: Globe, label: 'Site vitrine' },
  { icon: Target, label: 'Prospection CRM' },
  { icon: Mail, label: 'Gmail intégré' },
  { icon: Star, label: 'Avis Google' },
  { icon: FileImage, label: 'Avant/Après IA' },
  { icon: CreditCard, label: 'Paiements Stripe' },
  { icon: RefreshCw, label: 'Contrats récurrents' },
  { icon: Calculator, label: 'Maurice — Comptable IA' },
  { icon: Bot, label: 'Agents IA' },
];

export function Marquee() {
  return (
    <section className="py-5 border-y border-[var(--landing-border)] bg-[var(--landing-white)] overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-2 mx-8 shrink-0">
            <item.icon className="w-4 h-4 text-[var(--landing-accent)]" />
            <span className="text-sm font-medium text-[var(--landing-text)]">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
