'use client';

import { User } from 'lucide-react';

export function SidebarUser() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">Artisan</p>
        <p className="text-xs text-muted-foreground truncate">Non connecte</p>
      </div>
    </div>
  );
}
