import { describe, expect, it } from 'vitest';
import { compatibilityLabel, scoreCandidate } from './matchingScoring';
import { makeUser } from '@/test/factories';
import type { PreferenceProfile, Profile } from '@/types';

const preference: PreferenceProfile = {
  id: 'pref-1',
  userId: 'user-1',
  summary: 'Prefers Coding, Coffee, Curious people, Deep talks',
  hardFilters: [],
  softPreferences: ['Coding', 'Coffee'],
  feedbackSummary: ['accepted: Curious, Coffee'],
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('matching score helpers', () => {
  it('scores candidates with shared campus, major, interests, and intent higher', () => {
    const self = makeUser() as Profile;
    const strongCandidate = makeUser({
      id: 'candidate-strong',
      email: 'strong@fpt.edu.vn',
      interests: ['Coding', 'Coffee', 'Movies'],
      personalityTags: ['Curious'],
      datingGoals: ['Coffee dates'],
    }) as Profile;
    const weakCandidate = makeUser({
      id: 'candidate-weak',
      email: 'weak@fpt.edu.vn',
      major: 'Design',
      campus: 'Danang',
      interests: ['Fashion', 'Dance', 'Art'],
      personalityTags: ['Energetic'],
      datingGoals: ['Weekend hangouts'],
    }) as Profile;

    expect(scoreCandidate(self, strongCandidate, preference))
      .toBeGreaterThan(scoreCandidate(self, weakCandidate, preference));
  });

  it('maps score bands to compatibility labels', () => {
    expect(compatibilityLabel(90)).toBe('High intent fit');
    expect(compatibilityLabel(80)).toBe('Strong potential');
    expect(compatibilityLabel(70)).toBe('Worth exploring');
    expect(compatibilityLabel(50)).toBe('Fresh perspective');
  });
});
