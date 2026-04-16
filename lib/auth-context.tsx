'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface Profile {
  id: string;
  full_name: string;
  company_name: string;
  company_activity: string;
  avatar_url: string;
  onboarding_completed: boolean;
  email_verified: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  showOnboarding: boolean;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
  /** Recharge le profil depuis la DB (utile après upload d'un avatar). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  showOnboarding: false,
  completeOnboarding: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const claimPendingReferral = useCallback(async (accessToken: string) => {
    if (typeof window === 'undefined') return;
    let code: string | null = null;
    try {
      code = window.localStorage.getItem('hellobat_referral_code');
    } catch {
      return;
    }
    if (!code) return;
    try {
      const res = await fetch('/api/referral/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code }),
      });
      // Whether claimed, already claimed, or failed (e.g. self-referral) — don't retry forever.
      if (res.ok) {
        window.localStorage.removeItem('hellobat_referral_code');
      } else if (res.status === 400 || res.status === 404) {
        window.localStorage.removeItem('hellobat_referral_code');
      }
    } catch {
      // network error: keep the code in storage to retry on next session
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, company_activity, avatar_url, onboarding_completed, email_verified')
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
        void claimPendingReferral(nextSession.access_token);
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
  }, [fetchProfile, claimPendingReferral]);

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

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

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
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
