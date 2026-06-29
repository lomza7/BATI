'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserPlan = 'free' | 'starter' | 'pro' | 'business';

interface Profile {
  id: string;
  full_name: string;
  company_name: string;
  company_activity: string;
  onboarding_completed: boolean;
  plan: UserPlan;
  subscription_status: string;
  trial_end_at: string | null;
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
        .select('id, full_name, company_name, company_activity, onboarding_completed, plan, subscription_status, trial_end_at')
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

const PLAN_HIERARCHY: Record<UserPlan, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

export interface UserPlanState {
  plan: UserPlan;
  isStarter: boolean;
  isPro: boolean;
  isBusiness: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
  canAccess: (requiredPlan: UserPlan) => boolean;
}

export function useUserPlan(): UserPlanState {
  const { profile } = useAuth();
  const plan: UserPlan = (profile?.plan as UserPlan) ?? 'starter';
  const subscriptionStatus = profile?.subscription_status ?? 'inactive';
  const trialEndAt = profile?.trial_end_at ?? null;

  const isTrial = subscriptionStatus === 'trialing';
  const trialDaysLeft = isTrial && trialEndAt
    ? Math.max(0, Math.ceil((new Date(trialEndAt).getTime() - Date.now()) / 86_400_000))
    : 0;

  const canAccess = (requiredPlan: UserPlan) =>
    PLAN_HIERARCHY[plan] >= PLAN_HIERARCHY[requiredPlan];

  return {
    plan,
    isStarter: plan === 'starter' || plan === 'free',
    isPro: plan === 'pro',
    isBusiness: plan === 'business',
    isTrial,
    trialDaysLeft,
    canAccess,
  };
}
