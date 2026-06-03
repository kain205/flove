import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService } from '@/services/authService';
import type { User } from '@/types';
import { AuthContext, type AuthContextValue, type AuthServiceContract, type AuthStatus } from './authContextCore';
import { debugLog, debugWarn, elapsedMs, startTimer } from '@/lib/debugLog';

interface AuthProviderProps {
  children: ReactNode;
  service?: AuthServiceContract;
}

export function AuthProvider({ children, service = authService }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');

  useEffect(() => {
    let isActive = true;
    setStatus('checking');

    const unsubscribe = service.onAuthChanged((nextUser, nextStatus) => {
      if (!isActive) return;
      debugLog('auth', 'auth state changed', {
        status: nextStatus ?? (nextUser ? 'authenticated' : 'guest'),
        hasUser: Boolean(nextUser),
        userId: nextUser?.id,
      });
      setUser(nextUser);
      setStatus(nextStatus ?? (nextUser ? 'authenticated' : 'guest'));
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [service]);

  const setAuthenticatedUser = useCallback<AuthContextValue['setAuthenticatedUser']>((
    nextUser,
    nextStatus = 'authenticated'
  ) => {
    debugLog('auth', 'accepted immediate authenticated user', {
      status: nextStatus,
      userId: nextUser.id,
    });
    setUser(nextUser);
    setStatus(nextStatus);
  }, []);

  const refreshProfile = useCallback(async () => {
    const startedAt = startTimer();
    debugLog('auth', 'refresh profile start', {
      hasUser: Boolean(user),
      currentStatus: status,
    });
    setStatus(current => (user || current === 'authenticated' ? 'profileHydrating' : 'checking'));

    try {
      const nextUser = await service.getCurrentUser();
      setUser(nextUser);
      setStatus(nextUser ? 'authenticated' : 'guest');
      debugLog('auth', 'refresh profile done', {
        elapsedMs: elapsedMs(startedAt),
        hasUser: Boolean(nextUser),
        userId: nextUser?.id,
      });
      return nextUser;
    } catch (error) {
      setStatus(user ? 'authenticated' : 'guest');
      debugWarn('auth', 'refresh profile failed', {
        elapsedMs: elapsedMs(startedAt),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [service, status, user]);

  const signOut = useCallback(async () => {
    const startedAt = startTimer();
    const previousUser = user;
    setUser(null);
    setStatus('guest');
    debugLog('auth', 'sign out start', { userId: previousUser?.id });

    try {
      await service.logout();
      debugLog('auth', 'sign out done', { elapsedMs: elapsedMs(startedAt) });
    } catch (error) {
      setUser(previousUser);
      setStatus(previousUser ? 'authenticated' : 'guest');
      debugWarn('auth', 'sign out failed', {
        elapsedMs: elapsedMs(startedAt),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [service, user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    setAuthenticatedUser,
    refreshProfile,
    signOut,
  }), [refreshProfile, setAuthenticatedUser, signOut, status, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export type { AuthServiceContract, AuthStatus } from './authContextCore';
