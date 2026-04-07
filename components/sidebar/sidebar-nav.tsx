'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, FileText, Receipt, HardHat, CalendarDays, CalendarCheck, MapPin, Globe, Users, Mail, Star, Paintbrush, Bot, CreditCard, RefreshCw, Calculator, SquareCheck as CheckSquare, BookOpen, UsersRound, Contact, Shield, Package, Ruler, FolderOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useWorkspace } from '@/hooks/use-workspace';
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
      { label: 'Calendrier', href: '/calendrier', icon: CalendarCheck },
      { label: 'Mes tâches', href: '/taches', icon: CheckSquare },
      { label: 'Contacts', href: '/clients', icon: Contact },
      { label: 'Devis', href: '/devis', icon: FileText },
      { label: 'Factures', href: '/factures', icon: Receipt },
      { label: 'Mes prestations', href: '/prestations', icon: Package },
      { label: 'Mes documents', href: '/documents', icon: FolderOpen },
    ],
  },
  {
    title: 'Chantiers',
    items: [
      { label: 'Mes chantiers', href: '/chantiers', icon: HardHat },
      { label: 'Planning', href: '/planning', icon: CalendarDays },
      { label: 'Carte', href: '/carte', icon: MapPin },
      { label: 'Équipe', href: '/equipe', icon: UsersRound },
    ],
  },
  {
    title: 'Commercial',
    items: [
      { label: 'Catalogues', href: '/catalogues', icon: BookOpen },
      { label: 'Prospection', href: '/prospection', icon: Users },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Boîte mail', href: '/mail', icon: Mail },
      { label: 'Avis Google', href: '/avis', icon: Star },
    ],
  },
  {
    title: 'IA',
    items: [
      { label: 'Agents IA', href: '/agents', icon: Bot },
      { label: 'Plans IA', href: '/plans', icon: Ruler },
      { label: 'Rendus IA', href: '/rendus', icon: Paintbrush },
      { label: 'Site web IA', href: '/site-web', icon: Globe },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Paiement Stripe', href: '/paiements', icon: CreditCard },
      { label: 'Contrats récurrents', href: '/contrats', icon: RefreshCw },
      { label: 'Comptabilité IA', href: '/comptabilite', icon: Calculator },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasPermission } = useWorkspace();
  const isAdmin = user?.email === 'louis@maaza.pro';

  const filteredGroups = useMemo(() => {
    const allGroups = isAdmin
      ? [...navGroups, { title: 'Admin', items: [{ label: 'Administration', href: '/admin', icon: Shield }] }]
      : navGroups;

    return allGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => hasPermission(item.href)),
      }))
      .filter((group) => group.items.length > 0);
  }, [hasPermission, isAdmin]);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {filteredGroups.map((group) => (
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
