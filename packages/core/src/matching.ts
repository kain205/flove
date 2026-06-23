import type { PreferenceProfile, PublicProfile } from './types';

export const DAILY_PICK_LIMIT = 5;
export const MIN_DAILY_PICK_TARGET = 3;

export function localDateKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function batchIdFor(uid: string, date: string): string {
  return `${uid}_${date}`;
}

export function pairKeyFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

function joinVi(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} va ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} va ${items[items.length - 1]}`;
}

export function scoreCandidate(
  self: PublicProfile | null,
  candidate: PublicProfile,
  preference?: Partial<PreferenceProfile> | null
): number {
  const selfInterests = new Set(self?.interests ?? []);
  const sharedInterests = candidate.interests.filter(interest => selfInterests.has(interest));
  const preferenceText = [
    preference?.summary,
    ...(preference?.softPreferences ?? []),
    ...(preference?.feedbackSummary ?? []),
    ...(self?.preferredVibes ?? []),
    ...(self?.datingGoals ?? []),
  ].join(' ').toLowerCase();

  let score = 58;
  score += Math.min(sharedInterests.length * 10, 24);
  if (self?.campus && self.campus === candidate.campus) score += 10;
  if (self?.major && self.major === candidate.major) score += 6;
  candidate.personalityTags.forEach(tag => {
    if (preferenceText.includes(tag.toLowerCase())) score += 4;
  });
  candidate.datingGoals.forEach(goal => {
    if (self?.datingGoals.includes(goal)) score += 5;
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

export function buildFallbackReason(self: PublicProfile | null, candidate: PublicProfile): string {
  const shared = candidate.interests.filter(interest => self?.interests.includes(interest));
  const reasons: string[] = [];
  if (shared.length > 0) reasons.push(`ca hai cung quan tam ${joinVi(shared.slice(0, 2))}`);
  if (self?.campus === candidate.campus) reasons.push(`cung campus ${candidate.campus}`);
  if (self?.major === candidate.major) reasons.push(`cung nganh ${candidate.major}`);
  const goals = candidate.datingGoals.filter(goal => self?.datingGoals.includes(goal));
  if (goals.length > 0) reasons.push(`cung huong toi ${joinVi(goals.slice(0, 2))}`);
  if (candidate.bio) reasons.push(`profile cua ban ay noi ve: ${candidate.bio.slice(0, 90)}`);
  return `AI chon ${candidate.name} vi ${reasons.join(', ') || 'profile tao mot goc nhin moi nhung van hop voi tin hieu hien tai cua ban'}.`;
}
