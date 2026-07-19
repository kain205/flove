import {
  normalizeOnboardingAnswers,
  type AIProfileAnalysis,
  type AppearancePreference,
  type CuratedMatch,
  type Dealbreaker,
  type EmbeddingStatus,
  type Gender,
  type PreferenceProfile,
  type ProfileAiSignals,
  type ProfileText,
  type PublicProfile,
  type UserProfile,
} from '@flove/core';
import type { Database } from './database.types';

type CuratedMatchRow = Database['public']['Tables']['curated_matches']['Row'];
type PreferenceProfileRow = Database['public']['Tables']['preference_profiles']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type PublicProfileRow = Database['public']['Views']['public_profiles']['Row'];

function toDate(value: string | null | undefined): Date {
  return value ? new Date(value) : new Date();
}

function profileTextFromJson(value: unknown, bio: string): ProfileText {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { bio };
  }
  const data = value as Record<string, unknown>;
  return {
    bio: String(data.bio ?? bio),
    school: typeof data.school === 'string' ? data.school : '',
    majorLabel: typeof data.majorLabel === 'string' ? data.majorLabel : '',
    weekendStyle: typeof data.weekendStyle === 'string' ? data.weekendStyle : '',
    conversationStyle: typeof data.conversationStyle === 'string' ? data.conversationStyle : '',
    memorableThing: typeof data.memorableThing === 'string' ? data.memorableThing : '',
    relationshipIntent: typeof data.relationshipIntent === 'string' ? data.relationshipIntent : '',
  };
}

function aiSignalsFromJson(value: unknown): ProfileAiSignals | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as ProfileAiSignals;
}

function jsonObject<T>(value: unknown): T | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as T;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function aiProfileAnalysisFromJson(value: unknown): AIProfileAnalysis | undefined {
  const analysis = record(value);
  const publicProfile = record(analysis?.publicProfile);
  const signals = record(analysis?.matchingSignals);
  const review = record(analysis?.aiReview);
  const appearance = record(signals?.appearancePreference);
  if (!analysis || !publicProfile || !signals || !review || !appearance) return undefined;

  const signalArrays = [
    signals.intents,
    signals.selfTraits,
    signals.interests,
    signals.vibeTags,
    signals.preferredPartnerTraits,
  ];
  if (!signalArrays.every(stringArray) || !stringArray(publicProfile.conversationHooks)) return undefined;
  if (!stringArray(appearance.preferredStyleTags) || !stringArray(appearance.preferredAppearanceVibeTags)) {
    return undefined;
  }
  if (!Array.isArray(signals.dealbreakers)
    || !signals.dealbreakers.every(item => typeof record(item)?.trait === 'string')) {
    return undefined;
  }
  if (!['selfSummary', 'seekingSummary', 'idealMatchSummary', 'avoidSummary', 'suggestedBio']
    .every(key => typeof review[key] === 'string')) {
    return undefined;
  }
  return analysis as unknown as AIProfileAnalysis;
}

export function publicProfileFromRow(row: PublicProfileRow): PublicProfile {
  const bio = row.bio ?? '';
  return {
    id: row.id ?? '',
    name: row.name ?? 'Thành viên F-Love',
    age: row.age ?? 0,
    major: row.major ?? 'SE',
    campus: row.campus ?? 'HCM',
    avatarUrl: row.avatar_url ?? '',
    bio,
    interests: row.interests ?? [],
    personalityTags: row.personality_tags ?? [],
    datingGoals: row.dating_goals ?? [],
    preferredVibes: row.preferred_vibes ?? [],
    profileText: profileTextFromJson(row.profile_text, bio),
    profileCompleteness: row.profile_completeness ?? 0,
    gender: (row.gender ?? undefined) as Gender | undefined,
    heightCm: row.height_cm ?? null,
  };
}

export function userProfileFromRow(row: ProfileRow): UserProfile {
  const extended = row as unknown as Record<string, unknown>;
  return {
    ...publicProfileFromRow(row),
    email: row.email,
    onboardingSource: row.onboarding_source,
    aiSignals: aiSignalsFromJson(row.ai_signals),
    gender: row.gender as Gender,
    genderText: row.gender_text ?? undefined,
    lookingForGender: row.looking_for_gender ?? [],
    heightCm: row.height_cm ?? null,
    agePref: { min: row.age_pref_min ?? null, max: row.age_pref_max ?? null },
    appearancePreference: jsonObject<AppearancePreference>(row.appearance_preference),
    dealbreakers: Array.isArray(row.dealbreakers) ? (row.dealbreakers as unknown as Dealbreaker[]) : [],
    aiProfileAnalysis: aiProfileAnalysisFromJson(row.ai_profile_analysis) ?? null,
    profileConfirmed: row.profile_confirmed ?? false,
    onboardingAnswers: normalizeOnboardingAnswers(extended.onboarding_answers),
    onboardingVersion: Number(extended.onboarding_version) || 1,
    profileRevision: Number(extended.profile_revision) || 1,
    embeddingRevision: extended.embedding_revision == null ? null : Number(extended.embedding_revision),
    embeddingStatus: typeof extended.embedding_status === 'string'
      ? extended.embedding_status as EmbeddingStatus
      : undefined,
    profileUpgradeRequired: extended.profile_upgrade_required === true,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function preferenceProfileFromRow(row: PreferenceProfileRow): PreferenceProfile {
  const extended = row as unknown as Record<string, unknown>;
  return {
    id: row.id,
    userId: row.user_id,
    summary: row.summary,
    hardFilters: row.hard_filters ?? [],
    softPreferences: row.soft_preferences ?? [],
    softAvoidances: Array.isArray(extended.soft_avoidances)
      ? extended.soft_avoidances.filter((item): item is string => typeof item === 'string')
      : [],
    feedbackSummary: row.feedback_summary ?? [],
    updatedAt: toDate(row.updated_at),
  };
}

export function curatedMatchFromRow(row: CuratedMatchRow): CuratedMatch {
  return {
    id: row.id,
    batchId: row.batch_id,
    userId: row.user_id,
    candidateId: row.candidate_id,
    candidate: publicProfileFromRow(row.candidate_snapshot as unknown as PublicProfileRow),
    pairKey: row.pair_key,
    aiReason: row.ai_reason,
    suggestedOpener: row.suggested_opener ?? undefined,
    compatibilityLabel: row.compatibility_label,
    compatibilityScore: row.compatibility_score,
    status: row.status,
    feedbackTags: row.feedback_tags ?? [],
    feedbackNote: row.feedback_note ?? undefined,
    createdAt: toDate(row.created_at),
    decidedAt: row.decided_at ? toDate(row.decided_at) : undefined,
  };
}
