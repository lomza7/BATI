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
} from 'lucide-react';

const items = [
  { icon: FileText, label: 'Devis & Factures' },
  { icon: HardHat, label: 'Suivi chantiers' },
  { icon: CalendarDays, label: 'Planning' },
  { icon: MapPin, label: 'Carte interactive' },
  { icon: Globe, label: 'Site vitrine' },
  { icon: Target, label: 'Prospection CRM' },
  { icon: Mail, label: 'Emails integres' },
  { icon: Star, label: 'Avis Google' },
  { icon: FileImage, label: 'Plans & Rendus' },
  { icon: CreditCard, label: 'Paiements Stripe' },
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
