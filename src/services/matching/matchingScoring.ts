import type { PreferenceProfile, Profile } from '@/types';

const CAMPUS_LABELS_VI: Record<Profile['campus'], string> = {
  HCM: 'TP.HCM',
  Hanoi: 'Hà Nội',
  Danang: 'Đà Nẵng',
  Cantho: 'Cần Thơ',
};

function joinVi(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} và ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} và ${items[items.length - 1]}`;
}

export function campusLabelVi(campus: Profile['campus']): string {
  return CAMPUS_LABELS_VI[campus] ?? campus;
}

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
    reasons.push(`cả hai cùng nhắc đến ${joinVi(shared.slice(0, 2))}`);
  }
  if (self?.campus === candidate.campus) {
    reasons.push(`cùng học FPT ${campusLabelVi(candidate.campus)} nên dễ hẹn gặp hơn`);
  }
  if (self?.major === candidate.major) {
    reasons.push(`cùng bối cảnh ngành ${candidate.major}`);
  }
  const matchingGoals = candidate.datingGoals?.filter(goal => self?.datingGoals?.includes(goal)) ?? [];
  if (matchingGoals.length > 0) {
    reasons.push(`cùng hướng tới ${joinVi(matchingGoals.slice(0, 2))}`);
  }
  if (candidate.bio) {
    reasons.push(`tín hiệu profile: ${candidate.bio.slice(0, 90)}${candidate.bio.length > 90 ? '...' : ''}`);
  }

  if (reasons.length === 0) {
    reasons.push('profile của bạn ấy tạo một góc nhìn khác nhưng vẫn hợp với gu hiện tại của bạn');
  }

  return `AI chọn ${candidate.name} vì ${reasons.join(', ')}.`;
}
