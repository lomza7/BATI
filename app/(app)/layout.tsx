'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/sidebar';
import { SidebarProvider, useSidebar } from '@/lib/sidebar-context';
import { useAuth } from '@/lib/auth-context';
import { useWorkspace } from '@/hooks/use-workspace';
import { OnboardingModal } from '@/components/onboarding/onboarding-modal';
import { purgeExpiredRecycleBinItems } from '@/lib/recycle-bin';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { Toaster as ShadcnToaster } from '@/components/ui/toaster';
import { TrialBanner } from '@/components/paywall/trial-banner';

function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className={`pt-[60px] lg:pt-0 transition-[padding-left] duration-300 ease-in-out ${collapsed ? 'lg:pl-[60px]' : 'lg:pl-[240px]'}`}>
        <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <TrialBanner />
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, session, profile, loading, showOnboarding, completeOnboarding } = useAuth();
  const { hasPermission, loading: workspaceLoading } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const purgeTriggeredRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.email_verified === false) {
      router.replace('/verify-email');
    }
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (loading || workspaceLoading || !user || !pathname) return;
    if (!hasPermission(pathname)) {
      router.replace('/dashboard');
    }
  }, [loading, workspaceLoading, user, pathname, hasPermission, router]);

  useEffect(() => {
    if (!session?.access_token || !user) return;

    void fetch('/api/team/claim-pending', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }).catch(() => {
      // Silence volontaire: le flux principal ne doit pas etre bloque par la revendication d'une invitation.
    });
  }, [session?.access_token, user, user?.id]);

  useEffect(() => {
    if (!session?.access_token || !user || !pathname) return;

    void fetch('/api/team/presence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      // Fire-and-forget: on ne penalise jamais la navigation si le suivi d'activite echoue.
    });
  }, [pathname, session?.access_token, user, user?.id]);

  useEffect(() => {
    if (!user || purgeTriggeredRef.current) return;

    purgeTriggeredRef.current = true;
    void purgeExpiredRecycleBinItems().catch((error) => {
      console.error('Erreur purge corbeille:', error);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Hellobat" width={40} height={40} className="animate-nut-ratchet" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (profile?.email_verified === false) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppShell>
        {children}
        {showOnboarding && (
          <OnboardingModal
            open={showOnboarding}
            userId={user.id}
            onComplete={completeOnboarding}
          />
        )}
        <SonnerToaster />
        <ShadcnToaster />
      </AppShell>
    </SidebarProvider>
  );
}
