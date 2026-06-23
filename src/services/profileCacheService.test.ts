import { afterEach, describe, expect, it } from 'vitest';
import { getCachedProfile, saveCachedProfile, selectBestProfileSource } from './profileCacheService';
import { makeUser } from '@/test/factories';
import type { UserProfile } from '@/types';

afterEach(() => {
  localStorage.clear();
});

describe('profile cache service', () => {
  it('prefers a more complete cached profile over stale Firestore data', () => {
    const completeUser = makeUser({
      id: 'user-1',
      campus: 'Hanoi',
      profileCompleteness: 100,
    });
    const staleRemote = {
      ...makeUser({
        id: 'user-1',
        age: 0,
        interests: [],
        personalityTags: [],
        datingGoals: [],
        profileCompleteness: 38,
      }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    } as UserProfile;

    saveCachedProfile(completeUser, true);

    const selected = selectBestProfileSource(staleRemote, getCachedProfile('user-1'));

    expect(selected?.campus).toBe('Hanoi');
    expect(selected?.profileCompleteness).toBe(100);
  });

  it('prefers a pending cached profile even when Firestore has the same completeness', () => {
    const cachedUser = makeUser({
      id: 'user-1',
      campus: 'Hanoi',
      profileCompleteness: 100,
    });
    const staleRemote = {
      ...makeUser({
        id: 'user-1',
        campus: 'HCM',
        profileCompleteness: 100,
      }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    } as UserProfile;

    saveCachedProfile(cachedUser, true);

    const selected = selectBestProfileSource(staleRemote, getCachedProfile('user-1'));

    expect(selected?.campus).toBe('Hanoi');
  });
});
