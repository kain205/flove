import { describe, expect, it } from 'vitest';
import {
  calculateProfileCompleteness,
  getProfileReadiness,
  isFptEmail,
  localDateKey,
  pairKeyFor,
  scoreCandidate,
  type PublicProfile,
} from './index';

const baseProfile: PublicProfile = {
  id: 'u1',
  name: 'A',
  age: 21,
  major: 'SE',
  campus: 'HCM',
  avatarUrl: '',
  bio: 'Coffee and code',
  interests: ['Coding', 'Coffee', 'Music'],
  personalityTags: ['Chill'],
  datingGoals: ['Coffee dates'],
  preferredVibes: ['Deep talks'],
  profileText: { bio: 'Coffee and code' },
  profileCompleteness: 100,
};

describe('@flove/core', () => {
  it('validates FPT emails', () => {
    expect(isFptEmail('student@fpt.edu.vn')).toBe(true);
    expect(isFptEmail('student@gmail.com')).toBe(false);
  });

  it('builds stable pair keys', () => {
    expect(pairKeyFor('b', 'a')).toBe('a_b');
    expect(pairKeyFor('a', 'b')).toBe('a_b');
  });

  it('calculates profile completeness and readiness', () => {
    expect(calculateProfileCompleteness(baseProfile)).toBe(100);
    expect(getProfileReadiness(baseProfile).isComplete).toBe(true);
  });

  it('scores compatible candidates higher than the floor', () => {
    const candidate = { ...baseProfile, id: 'u2', name: 'B' };
    expect(scoreCandidate(baseProfile, candidate)).toBeGreaterThan(70);
  });

  it('formats local date keys', () => {
    expect(localDateKey(new Date('2026-06-23T03:00:00.000Z'))).toMatch(/2026-06-(22|23)/);
  });
});
