import type { CuratedMatch, DailyMatchBatch, PreferenceProfile, ProfileText, PublicProfile, UserProfile } from '@flove/core';
import type { CuratedMatchRow, DailyMatchBatchRow, PreferenceProfileRow, ProfileRow, PublicProfileRow } from './database.types';

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
    weekendStyle: typeof data.weekendStyle === 'string' ? data.weekendStyle : '',
    conversationStyle: typeof data.conversationStyle === 'string' ? data.conversationStyle : '',
    memorableThing: typeof data.memorableThing === 'string' ? data.memorableThing : '',
    relationshipIntent: typeof data.relationshipIntent === 'string' ? data.relationshipIntent : '',
  };
}

export function publicProfileFromRow(row: PublicProfileRow): PublicProfile {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    major: row.major,
    campus: row.campus,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    interests: row.interests ?? [],
    personalityTags: row.personality_tags ?? [],
    datingGoals: row.dating_goals ?? [],
    preferredVibes: row.preferred_vibes ?? [],
    profileText: profileTextFromJson(row.profile_text, row.bio),
    profileCompleteness: row.profile_completeness,
  };
}

export function userProfileFromRow(row: ProfileRow): UserProfile {
  return {
    ...publicProfileFromRow(row),
    email: row.email,
    onboardingSource: row.onboarding_source,
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
