import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService } from '@/services/authService';
import { AuthContext, type AuthContextValue, type AuthServiceContract, type AuthStatus } from './authContextCore';

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
      setUser(nextUser);
      setStatus(nextStatus ?? (nextUser ? 'authenticated' : 'guest'));
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [service]);

  const refreshProfile = useCallback(async () => {
    setStatus(current => (user || current === 'authenticated' ? 'profileHydrating' : 'checking'));

    try {
      const nextUser = await service.getCurrentUser();
      setUser(nextUser);
      setStatus(nextUser ? 'authenticated' : 'guest');
      return nextUser;
    } catch (error) {
      setStatus(user ? 'authenticated' : 'guest');
      throw error;
    }
  }, [service, user]);

  const signOut = useCallback(async () => {
    await service.logout();
    setUser(null);
    setStatus('guest');
  }, [service]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    refreshProfile,
    signOut,
  }), [refreshProfile, signOut, status, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export type { AuthServiceContract, AuthStatus } from './authContextCore';
