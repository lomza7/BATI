'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  HardHat,
  CalendarDays,
  MapPin,
  Globe,
  Users,
  Mail,
  Star,
  Paintbrush,
  Bot,
  CreditCard,
  RefreshCw,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Devis', href: '/devis', icon: FileText },
      { label: 'Factures', href: '/factures', icon: Receipt },
    ],
  },
  {
    title: 'Chantiers',
    items: [
      { label: 'Mes chantiers', href: '/chantiers', icon: HardHat },
      { label: 'Planning', href: '/planning', icon: CalendarDays },
      { label: 'Carte', href: '/carte', icon: MapPin },
    ],
  },
  {
    title: 'Developpement',
    items: [
      { label: 'Site web IA', href: '/site-web', icon: Globe },
      { label: 'Prospection', href: '/prospection', icon: Users },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Boite mail', href: '/mail', icon: Mail },
      { label: 'Avis Google', href: '/avis', icon: Star },
    ],
  },
  {
    title: 'Creativite',
    items: [
      { label: 'Plans & Rendus IA', href: '/plans-rendus', icon: Paintbrush },
    ],
  },
  {
    title: 'Agents IA',
    items: [
      { label: 'Mes Agents', href: '/agents', icon: Bot },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Paiement Stripe', href: '/paiements', icon: CreditCard },
      { label: 'Contrats recurrents', href: '/contrats', icon: RefreshCw },
      { label: 'Comptabilite IA', href: '/comptabilite', icon: Calculator },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {navGroups.map((group) => (
        <div key={group.title}>
          <p className="px-3 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                      isActive
                        ? 'bg-white text-foreground font-medium shadow-sm border-r-2 border-sidebar-accent'
                        : 'text-muted-foreground hover:bg-white/60 hover:text-foreground'
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive && 'text-sidebar-accent')} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
