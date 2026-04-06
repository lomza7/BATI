'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface Profile {
  id: string;
  full_name: string;
  company_name: string;
  company_activity: string;
  onboarding_completed: boolean;
  siret: string | null;
  insurance_decennale_number: string | null;
  insurance_decennale_company: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  showOnboarding: boolean;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  showOnboarding: false,
  completeOnboarding: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, company_activity, onboarding_completed, siret, insurance_decennale_number, insurance_decennale_company')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement profil:', error.message);
        setProfile(null);
        setShowOnboarding(false);
        return;
      }

      setProfile(data ?? null);
      setShowOnboarding(Boolean(data && !data.onboarding_completed));
    } catch (error) {
      console.error('Erreur inattendue chargement profil:', error);
      setProfile(null);
      setShowOnboarding(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadingSafetyTimer = window.setTimeout(() => {
      if (!mounted) return;
      console.error('Auth init timeout: sortie de secours du chargement.');
      setLoading(false);
    }, 4000);

    async function syncAuthState(nextSession: Session | null) {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setLoading(false);
        void fetchProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setShowOnboarding(false);
        setLoading(false);
      }
    }

    async function initializeAuth() {
      try {
        setLoading(true);
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        await syncAuthState(currentSession);
      } catch (error) {
        console.error('Erreur initialisation auth:', error);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setProfile(null);
        setShowOnboarding(false);
        setLoading(false);
      }
    }

    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setLoading(true);
        void syncAuthState(nextSession);
      }
    );

    return () => {
      mounted = false;
      window.clearTimeout(loadingSafetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    if (profile) {
      setProfile({ ...profile, onboarding_completed: true });
    }
  }, [profile]);

  const signOut = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setShowOnboarding(false);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        showOnboarding,
        completeOnboarding,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
