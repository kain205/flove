// Deno port of packages/core/src/matching-vectors.ts — keep the two in sync.
// Pure functions only; no platform APIs.

export type Vector = number[] | null | undefined;

export interface VectorSet {
  self: Vector;
  need: Vector;
  preference: Vector;
  communication: Vector;
  lifestyle: Vector;
}

export interface MatchProfile {
  id: string;
  age: number;
  gender: string;
  campus?: string;
  major?: string;
  heightCm?: number | null;
  lookingForGender: string[];
  agePrefMin?: number | null;
  agePrefMax?: number | null;
  appearancePreference?: any;
  dealbreakers?: Array<{ trait: string; severity: string; reason?: string }>;
  signals?: any;
  interests?: string[];
}

export const MATCH_WEIGHTS = {
  mutualPreference: 0.24,
  need: 0.18,
  communication: 0.15,
  lifestyle: 0.14,
  values: 0.12,
  selfSimilarity: 0.08,
  appearance: 0.06,
  novelty: 0.03,
};

const NEUTRAL_GENDERS = new Set(['other', 'prefer_not_to_show']);

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function cosine(a: Vector, b: Vector): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return clamp01(dot / (Math.sqrt(na) * Math.sqrt(nb)));
}

export function overlap(a: string[] = [], b: string[] = []): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  const shared = a.filter(item => bSet.has(item)).length;
  return shared / Math.max(a.length, b.length);
}

export function recordSimilarity(a: Record<string, number> = {}, b: Record<string, number> = {}): number {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  if (keys.length === 0) return 0;
  const distance = keys.reduce((sum, key) => sum + Math.abs((a[key] ?? 0) - (b[key] ?? 0)), 0) / keys.length;
  return clamp01(1 - distance);
}

function communicationRecord(signals: any): Record<string, number> {
  return signals?.communication ? { ...signals.communication } : {};
}

export function mutualPreference(self: MatchProfile, candidate: MatchProfile, selfVecs: VectorSet, candVecs: VectorSet): number {
  const aWantsB = cosine(selfVecs.preference, candVecs.self);
  const bWantsA = cosine(candVecs.preference, selfVecs.self);
  if (aWantsB > 0 || bWantsA > 0) return Math.sqrt(aWantsB * bWantsA);
  const aFallback = overlap(self.signals?.preferredPartnerTraits ?? [], [
    ...(candidate.signals?.selfTraits ?? []),
    ...(candidate.signals?.vibeTags ?? []),
  ]);
  const bFallback = overlap(candidate.signals?.preferredPartnerTraits ?? [], [
    ...(self.signals?.selfTraits ?? []),
    ...(self.signals?.vibeTags ?? []),
  ]);
  return Math.sqrt(aFallback * bFallback);
}

function discoveryOk(viewer: MatchProfile, target: MatchProfile): boolean {
  const wants = viewer.lookingForGender ?? [];
  if (wants.length === 0) return true;
  if (NEUTRAL_GENDERS.has(target.gender)) return true;
  if (wants.includes('everyone') || wants.includes('depends')) return true;
  return wants.includes(target.gender);
}

export function discoveryCompatible(self: MatchProfile, candidate: MatchProfile): boolean {
  return discoveryOk(self, candidate) && discoveryOk(candidate, self);
}

export function agePreferenceCompatible(self: MatchProfile, candidate: MatchProfile): boolean {
  if (self.agePrefMin != null && candidate.age < self.agePrefMin) return false;
  if (self.agePrefMax != null && candidate.age > self.agePrefMax) return false;
  if (candidate.agePrefMin != null && self.age < candidate.agePrefMin) return false;
  if (candidate.agePrefMax != null && self.age > candidate.agePrefMax) return false;
  return true;
}

export function heightHardCompatible(self: MatchProfile, candidate: MatchProfile): boolean {
  const hp = self.appearancePreference?.heightPreference;
  if (!hp || hp.importance !== 'hard') return true;
  const h = candidate.heightCm;
  if (h == null) return true;
  if (hp.minHeightCm != null && h < hp.minHeightCm) return false;
  if (hp.maxHeightCm != null && h > hp.maxHeightCm) return false;
  if (self.heightCm != null) {
    if (hp.prefersTallerThanSelf && h <= self.heightCm) return false;
    if (hp.prefersShorterThanSelf && h >= self.heightCm) return false;
  }
  return true;
}

function candidateTokens(candidate: MatchProfile): Set<string> {
  // The candidate's own traits/behaviours — NOT their dealbreakers (what they dislike),
  // so two people who share a dislike are not wrongly filtered out.
  const s = candidate.signals;
  return new Set(
    [
      ...(s?.vibeTags ?? []),
      ...(s?.selfTraits ?? []),
      ...(s?.intents ?? []),
      ...Object.keys(s?.lifestyle ?? {}),
      ...Object.keys(s?.personality ?? {}),
      ...(candidate.interests ?? []),
    ].map((token: string) => token.toLowerCase()),
  );
}

export function hardDealbreakerOk(self: MatchProfile, candidate: MatchProfile): boolean {
  const tokens = candidateTokens(candidate);
  const hard = [
    ...(self.dealbreakers ?? []),
    ...(self.appearancePreference?.physicalDealbreakers ?? []),
    ...(self.signals?.dealbreakers ?? []),
  ].filter((d: any) => d.severity === 'hard');
  return !hard.some((d: any) => tokens.has(String(d.trait).toLowerCase()));
}

export function passesHardFilters(self: MatchProfile, candidate: MatchProfile): boolean {
  return (
    self.id !== candidate.id
    && discoveryCompatible(self, candidate)
    && agePreferenceCompatible(self, candidate)
    && heightHardCompatible(self, candidate)
    && hardDealbreakerOk(self, candidate)
  );
}

function softDealbreakerPenalty(self: MatchProfile, candidate: MatchProfile): number {
  const tokens = candidateTokens(candidate);
  let penalty = 0;
  const all = [...(self.dealbreakers ?? []), ...(self.appearancePreference?.physicalDealbreakers ?? [])];
  for (const d of all) {
    if (!tokens.has(String(d.trait).toLowerCase())) continue;
    if (d.severity === 'medium') penalty += 0.15;
    else if (d.severity === 'soft') penalty += 0.05;
  }
  return Math.min(penalty, 0.4);
}

function appearanceFit(self: MatchProfile, candidate: MatchProfile): number {
  const pref = self.appearancePreference;
  if (!pref || pref.importance === 'none') return 0;
  const wanted = [...(pref.preferredStyleTags ?? []), ...(pref.preferredAppearanceVibeTags ?? [])];
  const candidateLook = [...(candidate.signals?.vibeTags ?? []), ...(candidate.signals?.selfTraits ?? [])];
  const weight = pref.importance === 'hard' ? 1 : pref.importance === 'medium' ? 0.7 : 0.4;
  return clamp01(overlap(wanted, candidateLook) * weight);
}

export function finalScore(self: MatchProfile, candidate: MatchProfile, selfVecs: VectorSet, candVecs: VectorSet): number {
  const mutualPref = mutualPreference(self, candidate, selfVecs, candVecs);
  const needFit = cosine(selfVecs.need, candVecs.need) || overlap(self.signals?.intents ?? [], candidate.signals?.intents ?? []);
  const commFit = cosine(selfVecs.communication, candVecs.communication)
    || recordSimilarity(communicationRecord(self.signals), communicationRecord(candidate.signals));
  const lifestyleFit = cosine(selfVecs.lifestyle, candVecs.lifestyle)
    || recordSimilarity(self.signals?.lifestyle ?? {}, candidate.signals?.lifestyle ?? {});
  const valuesFit = recordSimilarity(self.signals?.values ?? {}, candidate.signals?.values ?? {});
  const selfSim = cosine(selfVecs.self, candVecs.self) || overlap(self.interests ?? [], candidate.interests ?? []);
  const appearance = appearanceFit(self, candidate);
  const novelty = self.campus !== candidate.campus || self.major !== candidate.major ? 0.4 : 0.15;
  const penalty = softDealbreakerPenalty(self, candidate);

  return (
    MATCH_WEIGHTS.mutualPreference * mutualPref
    + MATCH_WEIGHTS.need * needFit
    + MATCH_WEIGHTS.communication * commFit
    + MATCH_WEIGHTS.lifestyle * lifestyleFit
    + MATCH_WEIGHTS.values * valuesFit
    + MATCH_WEIGHTS.selfSimilarity * selfSim
    + MATCH_WEIGHTS.appearance * appearance
    + MATCH_WEIGHTS.novelty * novelty
    - penalty
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
