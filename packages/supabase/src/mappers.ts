import type { AIProfileAnalysis, AppearancePreference, CuratedMatch, DailyMatchBatch, Dealbreaker, Gender, PreferenceProfile, ProfileAiSignals, ProfileText, PublicProfile, UserProfile } from '@flove/core';
import type { Database } from './database.types';

type CuratedMatchRow = Database['public']['Tables']['curated_matches']['Row'];
type DailyMatchBatchRow = Database['public']['Tables']['daily_match_batches']['Row'];
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

export function publicProfileFromRow(row: PublicProfileRow): PublicProfile {
  const bio = row.bio ?? '';
  return {
    id: row.id ?? '',
    name: row.name ?? 'FPT Student',
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
    aiProfileAnalysis: jsonObject<AIProfileAnalysis>(row.ai_profile_analysis) ?? null,
    profileConfirmed: row.profile_confirmed ?? false,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function preferenceProfileFromRow(row: PreferenceProfileRow): PreferenceProfile {
  return {
    id: row.id,
    userId: row.user_id,
    summary: row.summary,
    hardFilters: row.hard_filters ?? [],
    softPreferences: row.soft_preferences ?? [],
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

export function dailyMatchBatchFromRows(batch: DailyMatchBatchRow, matches: CuratedMatch[]): DailyMatchBatch {
  return {
    id: batch.id,
    userId: batch.user_id,
    date: batch.date,
    matches,
    createdAt: toDate(batch.created_at),
  };
}
