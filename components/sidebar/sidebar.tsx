'use client';

import { useState } from 'react';
import { Hexagon, Settings, CircleHelp as HelpCircle, Menu } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { SidebarUser } from './sidebar-user';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Hexagon className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          BatiFlow
        </span>
      </div>

      <SidebarNav onNavigate={onNavigate} />

      <div className="border-t border-sidebar-border p-3 space-y-0.5">
        <a
          href="/parametres"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          <span>Parametres</span>
        </a>
        <a
          href="/aide"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:flex w-[220px] flex-col bg-sidebar border-r border-sidebar-border">
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
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Hexagon className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">BatiFlow</span>
        </div>
      </div>
    </>
  );
}
