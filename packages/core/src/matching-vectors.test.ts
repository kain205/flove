import { describe, expect, it } from 'vitest';
import {
  cosine,
  discoveryCompatible,
  agePreferenceCompatible,
  heightHardCompatible,
  hardDealbreakerOk,
  passesHardFilters,
  finalScore,
  toCompatibilityScore,
  type MatchProfile,
  type VectorSet,
} from './matching-vectors';
import { EMPTY_APPEARANCE_PREFERENCE } from './types';

function profile(over: Partial<MatchProfile>): MatchProfile {
  return {
    id: 'u',
    age: 21,
    gender: 'male',
    campus: 'HCM',
    major: 'SE',
    lookingForGender: [],
    appearancePreference: EMPTY_APPEARANCE_PREFERENCE,
    dealbreakers: [],
    signals: null,
    interests: [],
    ...over,
  };
}

const emptyVecs: VectorSet = { self: null, need: null, preference: null, communication: null, lifestyle: null };

describe('cosine', () => {
  it('is 1 for identical vectors and 0 for orthogonal/empty', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 0], null)).toBe(0);
    expect(cosine([0, 0], [0, 0])).toBe(0);
  });
});

describe('hard filters', () => {
  it('respects mutual gender discovery', () => {
    const she = profile({ id: 'a', gender: 'female', lookingForGender: ['male'] });
    const he = profile({ id: 'b', gender: 'male', lookingForGender: ['female'] });
    const heWantsMen = profile({ id: 'c', gender: 'male', lookingForGender: ['male'] });
    expect(discoveryCompatible(she, he)).toBe(true);
    expect(discoveryCompatible(she, heWantsMen)).toBe(false);
  });

  it('never hard-excludes neutral genders and empty preferences', () => {
    const she = profile({ id: 'a', gender: 'female', lookingForGender: ['male'] });
    const hidden = profile({ id: 'b', gender: 'prefer_not_to_show', lookingForGender: [] });
    expect(discoveryCompatible(she, hidden)).toBe(true);
  });

  it('applies age preference only when bounds are set', () => {
    const self = profile({ id: 'a', age: 22, agePrefMin: 20, agePrefMax: 24 });
    expect(agePreferenceCompatible(self, profile({ id: 'b', age: 23 }))).toBe(true);
    expect(agePreferenceCompatible(self, profile({ id: 'b', age: 30 }))).toBe(false);
  });

  it('only hard-excludes height when importance is hard', () => {
    const hard = profile({
      id: 'a',
      appearancePreference: { ...EMPTY_APPEARANCE_PREFERENCE, heightPreference: { importance: 'hard', minHeightCm: 170 } },
    });
    expect(heightHardCompatible(hard, profile({ id: 'b', heightCm: 165 }))).toBe(false);
    expect(heightHardCompatible(hard, profile({ id: 'b', heightCm: 175 }))).toBe(true);
    expect(heightHardCompatible(hard, profile({ id: 'b', heightCm: null }))).toBe(true);
    const soft = profile({
      id: 'a',
      appearancePreference: { ...EMPTY_APPEARANCE_PREFERENCE, heightPreference: { importance: 'soft', minHeightCm: 170 } },
    });
    expect(heightHardCompatible(soft, profile({ id: 'b', heightCm: 160 }))).toBe(true);
  });

  it('excludes only on hard dealbreakers matching candidate traits (not the candidate\'s own dislikes)', () => {
    const self = profile({ id: 'a', dealbreakers: [{ trait: 'ghosting', severity: 'hard' }] });
    // Candidate who actually exhibits the trait (in vibeTags/selfTraits) is excluded...
    const ghoster = profile({ id: 'b', signals: { ...baseSignals, vibeTags: ['ghosting'] } });
    // ...but a candidate who merely *dislikes* the same thing is NOT excluded.
    const sharesDislike = profile({ id: 'c', signals: { ...baseSignals, dealbreakers: [{ trait: 'ghosting', severity: 'hard' }] } });
    const fine = profile({ id: 'd', signals: baseSignals });
    expect(hardDealbreakerOk(self, ghoster)).toBe(false);
    expect(hardDealbreakerOk(self, sharesDislike)).toBe(true);
    expect(hardDealbreakerOk(self, fine)).toBe(true);
    expect(passesHardFilters(self, fine)).toBe(true);
  });
});

const baseSignals = {
  intents: ['serious_relationship'],
  intentClarity: 0.8,
  seriousnessLevel: 0.8,
  relationshipPace: 'slow',
  selfTraits: ['curious'],
  interests: ['Coffee'],
  vibeTags: ['Chill'],
  values: { ambition: 0.7 },
  personality: { calm: 0.6 },
  lifestyle: { chill: 0.6 },
  preferredPartnerTraits: ['good_listener'],
  appearancePreference: EMPTY_APPEARANCE_PREFERENCE,
  communication: {
    deepTalk: 0.8,
    humor: 0.4,
    textingFrequency: 0.5,
    directness: 0.5,
    slowBurn: 0.7,
    initiatesConversation: 0.4,
    prefersInPersonSoon: 0.3,
    emotionalExpression: 0.6,
  },
  dealbreakers: [],
  confidence: 0.6,
};

describe('finalScore', () => {
  it('ranks an aligned candidate above an orthogonal one (vector path)', () => {
    const self = profile({ id: 'a', signals: baseSignals });
    const cand = profile({ id: 'b', signals: baseSignals });
    const selfVecs: VectorSet = { self: [1, 0, 0], need: [1, 0, 0], preference: [0, 1, 0], communication: [1, 0, 0], lifestyle: [1, 0, 0] };
    const aligned: VectorSet = { self: [1, 0, 0], need: [1, 0, 0], preference: [1, 0, 0], communication: [1, 0, 0], lifestyle: [1, 0, 0] };
    const orthogonal: VectorSet = { self: [0, 1, 0], need: [0, 1, 0], preference: [0, 0, 1], communication: [0, 1, 0], lifestyle: [0, 1, 0] };
    expect(finalScore(self, cand, selfVecs, aligned)).toBeGreaterThan(finalScore(self, cand, selfVecs, orthogonal));
  });

  it('degrades gracefully to signal-based scoring without vectors', () => {
    const self = profile({ id: 'a', signals: baseSignals, interests: ['Coffee', 'Music'] });
    const cand = profile({ id: 'b', signals: baseSignals, interests: ['Coffee', 'Music'] });
    const score = toCompatibilityScore(finalScore(self, cand, emptyVecs, emptyVecs), true);
    expect(score).toBeGreaterThanOrEqual(45);
    expect(score).toBeLessThanOrEqual(96);
  });
});
