import { describe, expect, it } from 'vitest';
import { getCurrentProfile } from './queries';

describe('current profile readiness boundary', () => {
  it('propagates getUser failures instead of treating them as missing onboarding', async () => {
    let queried = false;
    const authFailure = new Error('temporary auth gateway failure');
    const client = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: authFailure }),
      },
      from: () => {
        queried = true;
        throw new Error('profile query must not run after an auth failure');
      },
    };

    await expect(getCurrentProfile(client as never, 'user-a')).rejects.toBe(authFailure);
    expect(queried).toBe(false);
  });

  it('rejects an account switch before reading or caching a profile', async () => {
    let queried = false;
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-b' } }, error: null }),
      },
      from: () => {
        queried = true;
        throw new Error('profile query must remain fenced');
      },
    };

    await expect(getCurrentProfile(client as never, 'user-a')).rejects.toThrow(/Session changed/);
    expect(queried).toBe(false);
  });

  it('does not return null when the route still has an authenticated session', async () => {
    const client = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    };

    await expect(getCurrentProfile(client as never, 'user-a')).rejects.toThrow(/temporarily unavailable/);
  });
});
