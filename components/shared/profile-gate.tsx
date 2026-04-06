'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { isProfileComplete } from '@/app/(app)/profile/page';
import { Button } from '@/components/ui/button';

interface ProfileGateProps {
  children: React.ReactNode;
}

/**
 * Bloque l'accès aux modules Devis et Factures si le profil artisan
 * est incomplet (SIRET, assurance décennale obligatoires).
 */
export function ProfileGate({ children }: ProfileGateProps) {
  const { profile } = useAuth();

  // Si le profil n'est pas encore chargé ou est complet, on rend les enfants
  if (!profile || isProfileComplete(profile as Parameters<typeof isProfileComplete>[0])) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-4 text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
        <Shield className="h-8 w-8 text-amber-600" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-semibold">Profil incomplet</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Renseignez votre SIRET et votre assurance décennale pour accéder
          à ce module. Ces informations apparaissent sur vos documents légaux.
        </p>
      </div>

      <Button asChild size="lg" className="min-h-[52px] text-base w-full max-w-xs">
        <Link href="/profile">Compléter mon profil</Link>
      </Button>
    </div>
  );
}
