import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthServiceContract } from './AuthContext';
import { useAuth } from './useAuth';
import { makeUser } from '@/test/factories';

const AuthProbe = () => {
  const { status, user } = useAuth();
  return (
    <div>
      <span>{status}</span>
      <span>{user?.name}</span>
    </div>
  );
};

describe('AuthProvider', () => {
  it('exposes the user while profile hydration is still in progress', async () => {
    const service: AuthServiceContract = {
      getCurrentUser: vi.fn(),
      logout: vi.fn(),
      onAuthChanged: vi.fn(callback => {
        callback(makeUser({ name: 'Hydrating User' }), 'profileHydrating');
        return vi.fn();
      }),
    };

    render(
      <AuthProvider service={service}>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('profileHydrating')).toBeInTheDocument();
    expect(screen.getByText('Hydrating User')).toBeInTheDocument();
  });
});
