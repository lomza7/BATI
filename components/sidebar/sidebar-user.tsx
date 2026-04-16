'use client';

import { User, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

function initialsFrom(source: string | undefined | null): string | null {
  const s = (source || '').trim();
  if (!s) return null;
  const parts = s.split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return letters || s[0]!.toUpperCase();
}

export function SidebarUser() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const displayName = profile?.full_name || profile?.company_name || 'Artisan';
  const displayEmail = user?.email || 'Non connecte';
  const avatarUrl = profile?.avatar_url || '';
  const initials = initialsFrom(profile?.full_name) || initialsFrom(user?.email);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 overflow-hidden flex-shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
        ) : initials ? (
          <span className="text-[11px] font-semibold text-primary">{initials}</span>
        ) : (
          <User className="h-4 w-4 text-primary" />
        )}
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
