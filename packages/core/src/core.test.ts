import { describe, expect, it } from 'vitest';
import {
  calculateProfileCompleteness,
  businessDateKey,
  extractOnboardingSignals,
  getProfileReadiness,
  isFptEmail,
  localDateKey,
  normalizeOnboardingDraft,
  overlayProfileOnOnboardingDraft,
  pairKeyFor,
  scoreCandidate,
  type UserProfile,
} from './index';

const baseProfile: UserProfile = {
  id: 'u1',
  email: 'u1@fpt.edu.vn',
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
  onboardingSource: 'manual',
  profileConfirmed: true,
  aiSignals: {
    onboarding: {
      rawAnswers: [
        { questionId: 'intent', value: ['Mối quan hệ nghiêm túc'], answeredAt: '2026-06-23T00:00:00.000Z' },
        { questionId: 'vibe', value: 'Cafe yên tĩnh, đi dạo và nói chuyện sâu sau giờ học.', answeredAt: '2026-06-23T00:00:00.000Z' },
        { questionId: 'self_description', value: 'Mình hơi trầm lúc đầu nhưng thân rồi thì nói chuyện rất nhiều.', answeredAt: '2026-06-23T00:00:00.000Z' },
        { questionId: 'communication', value: ['Ít nhưng sâu'], answeredAt: '2026-06-23T00:00:00.000Z' },
        { questionId: 'values_chips', value: ['Có định hướng'], answeredAt: '2026-06-23T00:00:00.000Z' },
      ],
      extractedTraits: {
        intents: ['serious_relationship'],
        values: { ambition: 0.7 },
        interests: ['Coffee'],
        lifestyle: { chill: 0.4 },
        communication: { deep_talk: 0.7 },
        personality: { thoughtful: 0.7 },
        dealbreakers: [],
        preferredPartnerTraits: ['goal_oriented'],
        vibeTags: ['deep_talk'],
        confidence: 0.7,
        version: 'onboarding_v1',
      },
      completedAt: '2026-06-23T00:00:00.000Z',
    },
  },
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
    expect(getProfileReadiness({ ...baseProfile, aiSignals: undefined }).isComplete).toBe(true);
    expect(getProfileReadiness({ ...baseProfile, profileConfirmed: false }).isComplete).toBe(false);
    expect(getProfileReadiness({ ...baseProfile, profileCompleteness: 74 }).isComplete).toBe(false);
  });

  it('extracts onboarding signals deterministically', () => {
    const signals = extractOnboardingSignals([
      { questionId: 'intent', value: ['Mối quan hệ nghiêm túc', 'Người học/làm dự án cùng'], answeredAt: '2026-06-23T00:00:00.000Z' },
      { questionId: 'communication', value: ['Ít nhưng sâu', 'Slow burn'], answeredAt: '2026-06-23T00:00:00.000Z' },
      { questionId: 'values_chips', value: ['Có định hướng', 'Biết lắng nghe'], answeredAt: '2026-06-23T00:00:00.000Z' },
      { questionId: 'dealbreakers', value: ['Quá party'], answeredAt: '2026-06-23T00:00:00.000Z' },
      { questionId: 'vibe', value: 'Cafe yên tĩnh, đi dạo và nói chuyện sâu sau giờ học.', answeredAt: '2026-06-23T00:00:00.000Z' },
      { questionId: 'self_description', value: 'Mình hơi trầm lúc đầu nhưng thân rồi thì nói chuyện rất nhiều.', answeredAt: '2026-06-23T00:00:00.000Z' },
    ]);

    expect(signals.intents).toContain('serious_relationship');
    expect(signals.intents).toContain('study_partner');
    expect(signals.communication.deep_talk).toBeGreaterThan(0);
    expect(signals.communication.slow_burn).toBeGreaterThan(0);
    expect(signals.values.ambition).toBeGreaterThan(0);
    expect(signals.preferredPartnerTraits).toContain('goal_oriented');
    expect(signals.dealbreakers).toContain('too_party');
    expect(signals.confidence).toBeGreaterThan(0.3);
  });

  it('normalizes onboarding v2 drafts at the trust boundary', () => {
    const draft = normalizeOnboardingDraft({
      version: 2,
      step: 99,
      basic: { name: '  An  ', age: 20, lookingForGender: ['female'] },
      answers: [{ questionId: ' self_text ', value: '  Hello  ' }],
    });
    expect(draft).toMatchObject({
      version: 2,
      step: 6,
      basic: { name: 'An', age: 20 },
      answers: [{ questionId: 'self_text', value: 'Hello' }],
    });
    expect(normalizeOnboardingDraft({ version: 1 })).toBeNull();
  });

  it('overlays newer canonical profile edits without dropping preference answers', () => {
    const merged = overlayProfileOnOnboardingDraft({
      version: 2,
      step: 4,
      basic: { name: 'Old name', age: 19, campus: 'Hanoi' },
      answers: [
        { questionId: 'self_text', value: 'Old bio' },
        { questionId: 'attraction_text', value: 'Keep this preference' },
      ],
    }, {
      ...baseProfile,
      name: 'New name',
      age: 22,
      bio: 'New bio',
      profileText: { ...baseProfile.profileText, bio: 'New bio', school: 'FPT HCM' },
    });

    expect(merged.basic).toMatchObject({ name: 'New name', age: 22, campus: 'HCM', school: 'FPT HCM' });
    expect(merged.answers).toContainEqual({ questionId: 'self_text', value: 'Old bio' });
    expect(merged.answers).toContainEqual({ questionId: 'attraction_text', value: 'Keep this preference' });
  });

  it('scores compatible candidates higher than the floor', () => {
    const candidate = { ...baseProfile, id: 'u2', name: 'B' };
    expect(scoreCandidate(baseProfile, candidate)).toBeGreaterThan(70);
  });

  it('formats local date keys', () => {
    expect(localDateKey(new Date('2026-06-23T03:00:00.000Z'))).toBe('2026-06-23');
  });

  it('uses the Vietnam business day at the UTC boundary', () => {
    expect(businessDateKey(new Date('2026-06-22T16:59:59.999Z'))).toBe('2026-06-22');
    expect(businessDateKey(new Date('2026-06-22T17:00:00.000Z'))).toBe('2026-06-23');
  });
});
