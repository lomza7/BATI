'use client';

import { useState } from 'react';
import { Settings, CircleHelp as HelpCircle, Menu, Trash2, Gift, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { SidebarUser } from './sidebar-user';
import { CreditsBadge } from '@/components/credits/credits-badge';
import { HelpDialog } from '@/components/shared/help-dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/lib/sidebar-context';
import { cn } from '@/lib/utils';

function SidebarContent({
  onNavigate,
  collapsed = false,
  onOpenHelp,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onOpenHelp: () => void;
}) {
  return (
    <>
      <div className={cn('flex items-center gap-2.5 py-5', collapsed ? 'justify-center px-2' : 'px-5')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="Hellobat" width={32} height={32} />
        {!collapsed && (
          <>
            <span className="font-serif font-medium tracking-tight text-foreground text-lg">
              Hellobat
            </span>
            <div className="ml-auto">
              <CreditsBadge />
            </div>
          </>
        )}
      </div>

      {collapsed ? (
        <SidebarNavCollapsed />
      ) : (
        <SidebarNav onNavigate={onNavigate} />
      )}

      <div className={cn('border-t border-sidebar-border p-3 space-y-0.5', collapsed && 'px-1.5')}>
        {([
          { href: '/parrainage', icon: Gift, label: 'Lien de parrainage' },
          { href: '/parametres', icon: Settings, label: 'Paramètres' },
          { href: '/corbeille', icon: Trash2, label: 'Corbeille' },
        ] as const).map(({ href, icon: Icon, label }) => (
          <a
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center rounded-lg text-[15px] text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground',
              collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>{label}</span>}
          </a>
        ))}
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onOpenHelp();
          }}
          title={collapsed ? 'Aide' : undefined}
          className={cn(
            'w-full flex items-center rounded-lg text-[15px] text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground',
            collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
          )}
        >
          <HelpCircle className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Aide</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="border-t border-sidebar-border px-4 py-3">
          <SidebarUser />
        </div>
      )}
    </>
  );
}

/** Collapsed sidebar: shows only emojis/icons for nav items */
function SidebarNavCollapsed() {
  return (
    <nav className="flex-1 overflow-y-auto px-1.5 py-4 space-y-1">
      {[
        { emoji: '📊', href: '/dashboard', label: 'Tableau de bord' },
        { emoji: '📅', href: '/calendrier', label: 'Calendrier' },
        { emoji: '✅', href: '/taches', label: 'Mes tâches' },
        { emoji: '👤', href: '/clients', label: 'Contacts' },
        { emoji: '📝', href: '/devis', label: 'Devis' },
        { emoji: '🧾', href: '/factures', label: 'Factures' },
        { emoji: '🛠️', href: '/prestations', label: 'Mes prestations' },
        { emoji: '🏗️', href: '/chantiers', label: 'Mes chantiers' },
        { emoji: '🗺️', href: '/carte', label: 'Carte' },
        { emoji: '👷', href: '/equipe', label: 'Équipe' },
        { emoji: '🤖', href: '/agents', label: 'Agents IA' },
      ].map(({ emoji, href, label }) => (
        <a
          key={href}
          href={href}
          title={label}
          className="flex items-center justify-center rounded-lg py-2 text-lg hover:bg-white/60 transition-colors"
        >
          {emoji}
        </a>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { collapsed, toggle } = useSidebar();

  return (
    <>
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}>
        <SidebarContent collapsed={collapsed} onOpenHelp={() => setHelpOpen(true)} />
        <button
          type="button"
          onClick={toggle}
          className="absolute -right-3 top-7 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-sm hover:text-foreground hover:bg-white transition-colors"
          title={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
        >
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </aside>

      <div className="fixed top-0 left-0 right-0 z-30 flex lg:hidden items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] p-0 bg-sidebar">
            <div className="flex h-full flex-col">
              <SidebarContent onNavigate={() => setOpen(false)} onOpenHelp={() => setHelpOpen(true)} />
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Hellobat" width={28} height={28} />
          <span className="font-serif font-medium tracking-tight text-foreground text-base">Hellobat</span>
        </div>
      </div>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
