// Dependency-free deterministic matching engine.
// This file is imported by both the TypeScript packages and Supabase Deno functions.

export interface DeterministicMatchProfile {
  id: string;
  campus?: string;
  major?: string;
  appearancePreference?: {
    importance?: string;
    preferredStyleTags?: string[];
    preferredAppearanceVibeTags?: string[];
    physicalDealbreakers?: Array<{ trait: string; severity: string }>;
  } | null;
  dealbreakers?: Array<{ trait: string; severity: string }>;
  signals?: {
    intents?: string[];
    selfTraits?: string[];
    vibeTags?: string[];
    preferredPartnerTraits?: string[];
    communication?: object;
    lifestyle?: Record<string, number>;
    values?: Record<string, number>;
    dealbreakers?: Array<{ trait: string; severity: string }>;
  } | null;
  interests?: string[];
}

export interface MatchScoreComponents {
  mutualPreference: number;
  need: number;
  communication: number;
  lifestyle: number;
  values: number;
  selfSimilarity: number;
  appearance: number;
  novelty: number;
  /** Learned feedback contribution. It is capped so it can never bypass hard filters. */
  feedbackAdjustment: number;
  dealbreakerPenalty: number;
}

export type DatabaseMatchSimilarities = Partial<Omit<MatchScoreComponents, 'novelty' | 'dealbreakerPenalty'>>;

export const MATCH_WEIGHTS = {
  mutualPreference: 0.24,
  need: 0.18,
  communication: 0.15,
  lifestyle: 0.14,
  values: 0.12,
  selfSimilarity: 0.08,
  appearance: 0.06,
  novelty: 0.03,
} as const;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function scalarOrFallback(value: number | null | undefined, fallback: number): number {
  // A zero similarity is also how the SQL RPC represents a missing vector. Falling
  // back to profile signals keeps picks available while embedding jobs are pending.
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? clamp01(value) : fallback;
}

function scalarIncludingZero(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : fallback;
}

function clampFeedback(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-0.08, Math.min(0.08, value));
}

export function overlap(a: string[] = [], b: string[] = []): number {
  if (a.length === 0 || b.length === 0) return 0;
  const aSet = new Set(a.map(item => item.toLocaleLowerCase()));
  const bSet = new Set(b.map(item => item.toLocaleLowerCase()));
  const shared = new Set([...aSet].filter(item => bSet.has(item))).size;
  return shared / Math.max(aSet.size, bSet.size);
}

export function recordSimilarity(a: Record<string, number> = {}, b: Record<string, number> = {}): number {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  if (keys.length === 0) return 0;
  const distance = keys.reduce((sum, key) => sum + Math.abs((a[key] ?? 0) - (b[key] ?? 0)), 0) / keys.length;
  return clamp01(1 - distance);
}

function numericRecord(value: object | null | undefined): Record<string, number> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])),
  );
}

function candidateTokens(candidate: DeterministicMatchProfile): Set<string> {
  const signals = candidate.signals;
  return new Set(
    [
      ...(signals?.vibeTags ?? []),
      ...(signals?.selfTraits ?? []),
      ...(signals?.intents ?? []),
      ...Object.keys(signals?.lifestyle ?? {}),
      ...(candidate.interests ?? []),
    ].map(token => token.toLocaleLowerCase()),
  );
}

function softDealbreakerPenalty(self: DeterministicMatchProfile, candidate: DeterministicMatchProfile): number {
  const tokens = candidateTokens(candidate);
  let penalty = 0;
  const all = [...(self.dealbreakers ?? []), ...(self.appearancePreference?.physicalDealbreakers ?? [])];
  for (const dealbreaker of all) {
    if (!tokens.has(dealbreaker.trait.toLocaleLowerCase())) continue;
    if (dealbreaker.severity === 'medium') penalty += 0.15;
    else if (dealbreaker.severity === 'soft') penalty += 0.05;
  }
  return Math.min(penalty, 0.4);
}

function appearanceFit(self: DeterministicMatchProfile, candidate: DeterministicMatchProfile): number {
  const preference = self.appearancePreference;
  if (!preference || preference.importance === 'none') return 0;
  const wanted = [...(preference.preferredStyleTags ?? []), ...(preference.preferredAppearanceVibeTags ?? [])];
  const actual = [...(candidate.signals?.vibeTags ?? []), ...(candidate.signals?.selfTraits ?? [])];
  const weight = preference.importance === 'hard' ? 1 : preference.importance === 'medium' ? 0.7 : 0.4;
  return clamp01(overlap(wanted, actual) * weight);
}

function fallbackMutualPreference(self: DeterministicMatchProfile, candidate: DeterministicMatchProfile): number {
  const selfToCandidate = overlap(self.signals?.preferredPartnerTraits ?? [], [
    ...(candidate.signals?.selfTraits ?? []),
    ...(candidate.signals?.vibeTags ?? []),
  ]);
  const candidateToSelf = overlap(candidate.signals?.preferredPartnerTraits ?? [], [
    ...(self.signals?.selfTraits ?? []),
    ...(self.signals?.vibeTags ?? []),
  ]);
  return Math.sqrt(selfToCandidate * candidateToSelf);
}

/** Build deterministic components from DB scalars with profile-signal fallbacks. */
export function deterministicScoreComponents(
  self: DeterministicMatchProfile,
  candidate: DeterministicMatchProfile,
  similarities: DatabaseMatchSimilarities = {},
): MatchScoreComponents {
  return {
    mutualPreference: scalarIncludingZero(similarities.mutualPreference, fallbackMutualPreference(self, candidate)),
    need: scalarOrFallback(similarities.need, overlap(self.signals?.intents ?? [], candidate.signals?.intents ?? [])),
    communication: scalarOrFallback(
      similarities.communication,
      recordSimilarity(numericRecord(self.signals?.communication), numericRecord(candidate.signals?.communication)),
    ),
    lifestyle: scalarOrFallback(
      similarities.lifestyle,
      recordSimilarity(self.signals?.lifestyle ?? {}, candidate.signals?.lifestyle ?? {}),
    ),
    values: scalarOrFallback(
      similarities.values,
      recordSimilarity(self.signals?.values ?? {}, candidate.signals?.values ?? {}),
    ),
    selfSimilarity: scalarOrFallback(similarities.selfSimilarity, overlap(self.interests ?? [], candidate.interests ?? [])),
    appearance: scalarOrFallback(similarities.appearance, appearanceFit(self, candidate)),
    novelty: self.campus !== candidate.campus || self.major !== candidate.major ? 0.4 : 0.15,
    feedbackAdjustment: clampFeedback(similarities.feedbackAdjustment ?? 0),
    dealbreakerPenalty: softDealbreakerPenalty(self, candidate),
  };
}

export function scoreFromComponents(components: MatchScoreComponents): number {
  return (
    MATCH_WEIGHTS.mutualPreference * clamp01(components.mutualPreference)
    + MATCH_WEIGHTS.need * clamp01(components.need)
    + MATCH_WEIGHTS.communication * clamp01(components.communication)
    + MATCH_WEIGHTS.lifestyle * clamp01(components.lifestyle)
    + MATCH_WEIGHTS.values * clamp01(components.values)
    + MATCH_WEIGHTS.selfSimilarity * clamp01(components.selfSimilarity)
    + MATCH_WEIGHTS.appearance * clamp01(components.appearance)
    + MATCH_WEIGHTS.novelty * clamp01(components.novelty)
    + clampFeedback(components.feedbackAdjustment)
    - Math.max(0, Math.min(0.4, components.dealbreakerPenalty))
  );
}

export function toCompatibilityScore(weighted: number, sameCampus = false): number {
  const campusBoost = sameCampus ? 0.04 : 0;
  const score = Math.round((0.45 + Math.max(0, weighted) * 0.5 + campusBoost) * 100);
  return Math.max(45, Math.min(score, 96));
}

export function compatibilityLabel(score: number): string {
  if (score >= 86) return 'Rất hợp về ý định';
  if (score >= 74) return 'Tiềm năng mạnh';
  if (score >= 64) return 'Đáng khám phá';
  return 'Góc nhìn mới';
}
