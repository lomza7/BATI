'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/sidebar';
import { useAuth } from '@/lib/auth-context';
import { OnboardingModal } from '@/components/onboarding/onboarding-modal';
import { Hexagon } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, session, loading, showOnboarding, completeOnboarding } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Hexagon className="h-5 w-5 text-white animate-nut-ratchet" />
          </div>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pt-[60px] lg:pt-0 lg:pl-[220px]">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      {showOnboarding && (
        <OnboardingModal
          open={showOnboarding}
          userId={user.id}
          onComplete={completeOnboarding}
        />
      )}
    </div>
  );
}
