'use client';

import { useState } from 'react';
import { Settings, CircleHelp as HelpCircle, Menu, Trash2, Gift } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { SidebarUser } from './sidebar-user';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="Hellobat" width={32} height={32} />
        <span className="font-serif font-medium tracking-tight text-foreground text-lg">
          Hellobat
        </span>
      </div>

      <SidebarNav onNavigate={onNavigate} />

      <div className="border-t border-sidebar-border p-3 space-y-0.5">
        <a
          href="/parrainage"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
        >
          <Gift className="h-[18px] w-[18px]" />
          <span>Lien de parrainage</span>
        </a>
        <a
          href="/parametres"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
        >
          <Settings className="h-[18px] w-[18px]" />
          <span>Parametres</span>
        </a>
        <a
          href="/corbeille"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
        >
          <Trash2 className="h-[18px] w-[18px]" />
          <span>Corbeille</span>
        </a>
        <a
          href="/aide"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
        >
          <HelpCircle className="h-[18px] w-[18px]" />
          <span>Aide</span>
        </a>
      </div>

      <div className="border-t border-sidebar-border px-4 py-3">
        <SidebarUser />
      </div>
    </>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:flex w-[240px] flex-col bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
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
              <SidebarContent onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Hellobat" width={28} height={28} />
          <span className="font-serif font-medium tracking-tight text-foreground text-base">Hellobat</span>
        </div>
      </div>
    </>
  );
}
