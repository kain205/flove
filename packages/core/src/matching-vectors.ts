// Pure, dependency-free matching math for the embedding pipeline.
// Vector-specific helpers for core tests. The shared scalar ranking equation lives in
// matching-engine.ts and is imported directly by the Deno Edge Function.

import type { AppearancePreference, Dealbreaker, Gender, MatchingSignals } from './types';
import {
  MATCH_WEIGHTS,
  clamp01,
  deterministicScoreComponents,
  overlap,
  recordSimilarity,
  scoreFromComponents,
  toCompatibilityScore,
  type DatabaseMatchSimilarities,
  type MatchScoreComponents,
} from './matching-engine';

export {
  MATCH_WEIGHTS,
  deterministicScoreComponents,
  overlap,
  recordSimilarity,
  scoreFromComponents,
  toCompatibilityScore,
  type DatabaseMatchSimilarities,
  type MatchScoreComponents,
};

export type Vector = number[] | null | undefined;

export interface VectorSet {
  self: Vector;
  need: Vector;
  preference: Vector;
  communication: Vector;
  lifestyle: Vector;
}

/** Minimal profile shape the scorer needs (works for both self and candidate). */
export interface MatchProfile {
  id: string;
  age: number;
  gender: Gender;
  campus?: string;
  major?: string;
  heightCm?: number | null;
  lookingForGender: string[];
  agePrefMin?: number | null;
  agePrefMax?: number | null;
  appearancePreference?: AppearancePreference | null;
  dealbreakers?: Dealbreaker[];
  signals?: MatchingSignals | null;
  interests?: string[];
}

/** Cosine similarity in 0..1 (negative similarities are clamped to 0). Safe on null/zero vectors. */
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

/** Overlap ratio of two string lists (Jaccard-ish, normalized by the larger list). */
function communicationRecord(signals?: MatchingSignals | null): Record<string, number> {
  return signals?.communication ? { ...signals.communication } : {};
}

/**
 * Mutual preference: geometric mean of "self wants candidate" and "candidate wants self",
 * each measured as cosine(preference_vector, other.self_vector). Falls back to trait overlap
 * when embeddings are missing so matching still works before vectors are generated.
 */
export function mutualPreference(self: MatchProfile, candidate: MatchProfile, selfVecs: VectorSet, candVecs: VectorSet): number {
  const aWantsB = cosine(selfVecs.preference, candVecs.self);
  const bWantsA = cosine(candVecs.preference, selfVecs.self);
  if (aWantsB > 0 || bWantsA > 0) return Math.sqrt(aWantsB * bWantsA);
  const aWantsBFallback = overlap(self.signals?.preferredPartnerTraits ?? [], [
    ...(candidate.signals?.selfTraits ?? []),
    ...(candidate.signals?.vibeTags ?? []),
  ]);
  const bWantsAFallback = overlap(candidate.signals?.preferredPartnerTraits ?? [], [
    ...(self.signals?.selfTraits ?? []),
    ...(self.signals?.vibeTags ?? []),
  ]);
  return Math.sqrt(aWantsBFallback * bWantsAFallback);
}

// --- Hard filters -----------------------------------------------------------

function discoveryOk(viewer: MatchProfile, target: MatchProfile): boolean {
  const wants = viewer.lookingForGender ?? [];
  if (wants.length === 0) return true;
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

/** Height only hard-excludes when the viewer marked height preference as 'hard'. */
export function heightHardCompatible(self: MatchProfile, candidate: MatchProfile): boolean {
  const hp = self.appearancePreference?.heightPreference;
  if (!hp || hp.importance !== 'hard') return true;
  const h = candidate.heightCm;
  const hasDirection = Boolean(hp.prefersTallerThanSelf || hp.prefersShorterThanSelf);
  const hasConstraint = hp.minHeightCm != null || hp.maxHeightCm != null || hasDirection;
  if (hasDirection && self.heightCm == null) return false;
  if (h == null) return !hasConstraint;
  if (hp.minHeightCm != null && h < hp.minHeightCm) return false;
  if (hp.maxHeightCm != null && h > hp.maxHeightCm) return false;
  if (hp.prefersTallerThanSelf && h <= self.heightCm!) return false;
  if (hp.prefersShorterThanSelf && h >= self.heightCm!) return false;
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
    ].map(token => token.toLowerCase()),
  );
}

/** True when no 'hard' dealbreaker (behavioural or physical) is triggered by the candidate. */
export function hardDealbreakerOk(self: MatchProfile, candidate: MatchProfile): boolean {
  const tokens = candidateTokens(candidate);
  const hard = [
    ...(self.dealbreakers ?? []),
    ...(self.appearancePreference?.physicalDealbreakers ?? []),
    ...(self.signals?.dealbreakers ?? []),
  ].filter(d => d.severity === 'hard');
  return !hard.some(d => tokens.has(d.trait.toLowerCase()));
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

/** Raw weighted compatibility in roughly [-0.4, 1]; map to a display score with `toCompatibilityScore`. */
export function finalScore(self: MatchProfile, candidate: MatchProfile, selfVecs: VectorSet, candVecs: VectorSet): number {
  const fallback = deterministicScoreComponents(self, candidate);
  const mutualPref = mutualPreference(self, candidate, selfVecs, candVecs);
  const needFit = cosine(selfVecs.need, candVecs.need) || overlap(self.signals?.intents ?? [], candidate.signals?.intents ?? []);
  const commFit = cosine(selfVecs.communication, candVecs.communication)
    || recordSimilarity(communicationRecord(self.signals), communicationRecord(candidate.signals));
  const lifestyleFit = cosine(selfVecs.lifestyle, candVecs.lifestyle)
    || recordSimilarity(self.signals?.lifestyle ?? {}, candidate.signals?.lifestyle ?? {});
  const selfSim = cosine(selfVecs.self, candVecs.self) || overlap(self.interests ?? [], candidate.interests ?? []);

  return scoreFromComponents({
    ...fallback,
    mutualPreference: mutualPref,
    need: needFit,
    communication: commFit,
    lifestyle: lifestyleFit,
    selfSimilarity: selfSim,
  });
}
