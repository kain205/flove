import { useContext } from 'react';
import { AuthContext } from './authContextCore';
import type { AuthContextValue } from './authContextCore';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export type { AuthServiceContract, AuthStatus } from './authContextCore';
