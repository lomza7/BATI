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
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, company_activity, onboarding_completed')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setProfile(data);
      if (!data.onboarding_completed) {
        setShowOnboarding(true);
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          (async () => {
            await fetchProfile(s.user.id);
          })();
        } else {
          setProfile(null);
          setShowOnboarding(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    if (profile) {
      setProfile({ ...profile, onboarding_completed: true });
    }
  }, [profile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setShowOnboarding(false);
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
