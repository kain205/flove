import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToConversationInvalidations } from '@flove/supabase';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let authEventVersion = 0;

    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== nextUserId) {
        // Protected React Query data must never survive an account switch.
        queryClient.clear();
      }
      previousUserId.current = nextUserId;
      setSession(nextSession);
      setIsLoading(false);
    };

    const bootstrapVersion = authEventVersion;
    supabase.auth.getSession().then(({ data }) => {
      // INITIAL_SESSION/SIGNED_IN can arrive before getSession resolves. Never
      // let the older bootstrap snapshot overwrite that newer auth event.
      if (!active || authEventVersion !== bootstrapVersion) return;
      applySession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      authEventVersion += 1;
      applySession(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    const channel = subscribeToConversationInvalidations(supabase, queryClient, userId);
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, session?.user.id]);

  const value = useMemo(() => ({ session, isLoading }), [isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
