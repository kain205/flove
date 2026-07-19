import type { ProfileRequirementId } from './profile';
import type { ApiFailure, DailyMatchBatch, PreferenceProfile, PublicProfile } from './types';
import { compatibilityLabel } from './matching-engine';

export { compatibilityLabel };

export const DAILY_PICK_LIMIT = 5;
export const MIN_DAILY_PICK_TARGET = 3;
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const MATCH_ALGORITHM_VERSION = 'deterministic-v2';

export type EmptyDailyMatchesReason = 'no_eligible_candidates' | 'all_recently_seen';

export type DailyMatchesResult =
  | {
      status: 'ready';
      businessDate: string;
      batch: DailyMatchBatch;
      source: 'cached' | 'generated';
    }
  | {
      status: 'processing';
      businessDate: string;
      retryAfterMs: number;
    }
  | {
      status: 'empty';
      businessDate: string;
      reason: EmptyDailyMatchesReason;
      retryAfterAt: string;
    }
  | {
      status: 'needs_onboarding';
      missing: ProfileRequirementId[];
    };

export function isApiFailure(value: unknown): value is ApiFailure {
  if (!value || typeof value !== 'object') return false;
  const failure = value as Partial<ApiFailure>;
  return failure.ok === false
    && Boolean(failure.error)
    && typeof failure.error?.code === 'string'
    && typeof failure.error?.message === 'string'
    && typeof failure.error?.retryable === 'boolean'
    && typeof failure.error?.requestId === 'string';
}

/**
 * Calendar date owned by the backend for all daily product semantics.
 * `formatToParts` avoids relying on locale-specific formatted output.
 */
export function businessDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** @deprecated Daily batches use `businessDateKey` and must be resolved by the backend. */
export function localDateKey(date = new Date()): string {
  return businessDateKey(date);
}

export function batchIdFor(uid: string, date: string): string {
  return `${uid}_${date}`;
}

export function pairKeyFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

function joinVi(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} và ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} và ${items[items.length - 1]}`;
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
  const avoidanceText = (preference?.softAvoidances ?? []).join(' ').toLowerCase();

  let score = 58;
  score += Math.min(sharedInterests.length * 10, 24);
  if (self?.campus && self.campus === candidate.campus) score += 10;
  if (self?.major && self.major === candidate.major) score += 6;
  candidate.personalityTags.forEach(tag => {
    if (preferenceText.includes(tag.toLowerCase())) score += 4;
    if (avoidanceText.includes(tag.toLowerCase())) score -= 4;
  });
  candidate.datingGoals.forEach(goal => {
    if (self?.datingGoals.includes(goal)) score += 5;
  });
  candidate.interests.forEach(interest => {
    if (preferenceText.includes(interest.toLowerCase())) score += 4;
    if (avoidanceText.includes(interest.toLowerCase())) score -= 4;
  });

  return Math.max(45, Math.min(score, 96));
}

export function buildFallbackReason(self: PublicProfile | null, candidate: PublicProfile): string {
  const shared = candidate.interests.filter(interest => self?.interests.includes(interest));
  const reasons: string[] = [];
  if (shared.length > 0) reasons.push(`cả hai cùng quan tâm ${joinVi(shared.slice(0, 2))}`);
  if (self?.campus === candidate.campus && candidate.profileText.school) reasons.push(`cùng học tại ${candidate.profileText.school}`);
  if (self?.major === candidate.major && candidate.profileText.majorLabel) reasons.push(`cùng ngành ${candidate.profileText.majorLabel}`);
  const goals = candidate.datingGoals.filter(goal => self?.datingGoals.includes(goal));
  if (goals.length > 0) reasons.push(`cùng hướng tới ${joinVi(goals.slice(0, 2))}`);
  if (candidate.bio) reasons.push(`hồ sơ của bạn ấy nói về: ${candidate.bio.slice(0, 90)}`);
  return `AI chọn ${candidate.name} vì ${reasons.join(', ') || 'hồ sơ tạo một góc nhìn mới nhưng vẫn hợp với tín hiệu hiện tại của bạn'}.`;
}
