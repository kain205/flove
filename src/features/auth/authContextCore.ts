import { createContext } from 'react';
import type { User } from '@/types';

export type AuthStatus = 'checking' | 'guest' | 'authenticated' | 'profileHydrating';

export interface AuthServiceContract {
  getCurrentUser(): Promise<User | null>;
  logout(): Promise<void>;
  onAuthChanged(callback: (user: User | null, status?: AuthStatus) => void): () => void;
}

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  refreshProfile: () => Promise<User | null>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
