import type { PreferenceProfile, Profile } from '@/types';

export function scoreCandidate(
  self: Profile | null,
  candidate: Profile,
  preference: PreferenceProfile
): number {
  const selfInterests = new Set(self?.interests ?? []);
  const sharedInterests = candidate.interests.filter(interest => selfInterests.has(interest));
  const preferenceText = [
    preference.summary,
    ...preference.softPreferences,
    ...preference.feedbackSummary,
    ...(self?.preferredVibes ?? []),
    ...(self?.datingGoals ?? []),
  ].join(' ').toLowerCase();

  let score = 58;
  score += Math.min(sharedInterests.length * 10, 24);
  if (self?.campus && self.campus === candidate.campus) score += 10;
  if (self?.major && self.major === candidate.major) score += 6;
  candidate.personalityTags?.forEach(tag => {
    if (preferenceText.includes(tag.toLowerCase())) score += 4;
  });
  candidate.datingGoals?.forEach(goal => {
    if (self?.datingGoals?.includes(goal)) score += 5;
  });
  candidate.interests.forEach(interest => {
    if (preferenceText.includes(interest.toLowerCase())) score += 4;
  });

  return Math.max(45, Math.min(score, 96));
}

export function compatibilityLabel(score: number): string {
  if (score >= 86) return 'High intent fit';
  if (score >= 74) return 'Strong potential';
  if (score >= 64) return 'Worth exploring';
  return 'Fresh perspective';
}

export function buildAiReason(self: Profile | null, candidate: Profile, score: number): string {
  const shared = candidate.interests.filter(interest => self?.interests.includes(interest));
  const reasons: string[] = [];

  if (shared.length > 0) {
    reasons.push(`You both mention ${shared.slice(0, 2).join(' and ')}`);
  }
  if (self?.campus === candidate.campus) {
    reasons.push(`same FPT ${candidate.campus} campus makes meeting easier`);
  }
  if (self?.major === candidate.major) {
    reasons.push(`similar academic context in ${candidate.major}`);
  }
  const matchingGoals = candidate.datingGoals?.filter(goal => self?.datingGoals?.includes(goal)) ?? [];
  if (matchingGoals.length > 0) {
    reasons.push(`similar intent around ${matchingGoals.slice(0, 2).join(' and ')}`);
  }
  if (candidate.bio) {
    reasons.push(`their bio suggests: "${candidate.bio.slice(0, 90)}${candidate.bio.length > 90 ? '...' : ''}"`);
  }

  if (reasons.length === 0) {
    reasons.push('their profile adds a different but compatible perspective to your current preference pattern');
  }

  return `${compatibilityLabel(score)} because ${reasons.join(', ')}.`;
}
