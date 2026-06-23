import type { User, UserProfile } from '@/types';
import { calculateProfileCompleteness } from './profileService';

const PROFILE_CACHE_KEY = 'flove-profile-cache-v1';

interface CachedProfileEntry {
  cachedAt: string;
  pendingSync: boolean;
  profile: User;
}

type ProfileCache = Record<string, CachedProfileEntry>;
type CachedProfile = Partial<UserProfile> & {
  __cachedAt?: string;
  __pendingSync?: boolean;
};

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readCache(): ProfileCache {
  if (!storageAvailable()) return {};
  const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as ProfileCache;
  } catch {
    return {};
  }
}

function writeCache(cache: ProfileCache): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
}

function completenessOf(profile: Partial<User> | null | undefined): number {
  if (!profile) return 0;
  return profile.profileCompleteness ?? calculateProfileCompleteness(profile);
}

export function saveCachedProfile(user: User, pendingSync = false): void {
  writeCache({
    ...readCache(),
    [user.id]: {
      cachedAt: new Date().toISOString(),
      pendingSync,
      profile: user,
    },
  });
}

export function getCachedProfile(uid: string): CachedProfile | null {
  const entry = readCache()[uid];
  if (!entry) return null;

  return {
    ...entry.profile,
    id: uid,
    createdAt: new Date(entry.cachedAt),
    __cachedAt: entry.cachedAt,
    __pendingSync: entry.pendingSync,
  };
}

export function isPendingCachedProfile(profile: Partial<UserProfile> | null | undefined): boolean {
  return Boolean((profile as CachedProfile | null | undefined)?.__pendingSync);
}

export function selectBestProfileSource<T extends Partial<UserProfile>>(
  remoteProfile: T | null,
  cachedProfile: CachedProfile | null
): T | Partial<UserProfile> | null {
  if (!cachedProfile) return remoteProfile;
  if (!remoteProfile) return cachedProfile;
  if (cachedProfile.__pendingSync) return { ...remoteProfile, ...cachedProfile };

  return completenessOf(cachedProfile) > completenessOf(remoteProfile)
    ? { ...remoteProfile, ...cachedProfile }
    : remoteProfile;
}

export function clearCachedProfile(uid: string): void {
  const cache = readCache();
  if (!cache[uid]) return;
  delete cache[uid];
  writeCache(cache);
}
