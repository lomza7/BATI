'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, Shield, FileCheck, Building2, Zap, BadgeCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { ProfileForm } from '@/components/profile/profile-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ProfilePage() {
  const { user, profile: authProfile } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (fetchError) {
      setError('Impossible de charger votre profil.');
    } else {
      setProfile(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil artisan"
        description="Vos informations légales préremplissent automatiquement vos devis et factures."
      />

      {profile && !isProfileComplete(profile) && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Profil incomplet.</strong> Remplissez les champs obligatoires pour accéder aux modules Devis et Factures.
          </AlertDescription>
        </Alert>
      )}

      <ProfileForm
        profile={profile}
        onSaved={fetchProfile}
      />
    </div>
  );
}

export interface FullProfile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  siret: string | null;
  naf_code: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  insurance_decennale_number: string | null;
  insurance_decennale_company: string | null;
  insurance_decennale_expiry: string | null;
  rge_number: string | null;
  rge_valid_until: string | null;
  is_auto_entrepreneur: boolean;
  tva_number: string | null;
}

export function isProfileComplete(profile: FullProfile): boolean {
  return Boolean(
    profile.siret &&
    profile.insurance_decennale_number &&
    profile.insurance_decennale_company
  );
}
