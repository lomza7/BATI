'use client';

import { User, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export function SidebarUser() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const displayName = profile?.full_name || profile?.company_name || 'Artisan';
  const displayEmail = user?.email || 'Non connecte';

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-foreground truncate">{displayName}</p>
        <p className="text-[13px] text-muted-foreground truncate">{displayEmail}</p>
      </div>
      {user && (
        <button
          onClick={handleSignOut}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
          title="Se deconnecter"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
