import {
  normalizeOnboardingDraft,
  type AIProfileAnalysis,
  type CuratedMatch,
  type DailyMatchBatch,
  type OnboardingDraftV2,
  type PersistedOnboardingDraft,
  type UserProfile,
} from '@flove/core';
import type { FloveSupabaseClient } from './client';
import type { Database, Json } from './database.types';
import { curatedMatchFromRow, dailyMatchBatchFromRows, userProfileFromRow } from './mappers';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface PreferenceChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

// Embeddings are internal ranking inputs. Keeping an explicit projection here
// prevents five 1536-dimension vectors from crossing the DB/client boundary.
const CURRENT_PROFILE_COLUMNS = [
  'id',
  'email',
  'name',
  'age',
  'major',
  'campus',
  'avatar_url',
  'bio',
  'interests',
  'personality_tags',
  'dating_goals',
  'preferred_vibes',
  'profile_text',
  'profile_completeness',
  'onboarding_source',
  'ai_signals',
  'created_at',
  'updated_at',
  'gender',
  'gender_text',
  'looking_for_gender',
  'height_cm',
  'age_pref_min',
  'age_pref_max',
  'appearance_preference',
  'dealbreakers',
  'ai_profile_analysis',
  'profile_confirmed',
  'onboarding_answers',
  'onboarding_version',
  'profile_revision',
  'profile_upgrade_required',
  'embedding_revision',
  'embedding_status',
].join(',');

export async function getCurrentProfile(
  client: FloveSupabaseClient,
  expectedUserId?: string,
): Promise<UserProfile | null> {
  const { data: auth, error: authError } = await client.auth.getUser();
  // A transient auth/gateway failure is not evidence that onboarding is
  // missing. Route guards must render their retry state instead of caching null.
  if (authError) throw authError;
  if (!auth.user) {
    if (expectedUserId) throw new Error('Authenticated session is temporarily unavailable.');
    return null;
  }
  if (expectedUserId && auth.user.id !== expectedUserId) {
    throw new Error('Session changed while loading profile.');
  }

  const { data, error } = await client
    .from('profiles')
    .select(CURRENT_PROFILE_COLUMNS)
    .eq('id', expectedUserId ?? auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? userProfileFromRow(data as unknown as ProfileRow) : null;
}

/**
 * Loads the authenticated owner's preference-learning conversation. The
 * explicit projection keeps request payloads/idempotency metadata server-side,
 * and the expected user fences account switches while a query is in flight.
 */
export async function getPreferenceChatMessages(
  client: FloveSupabaseClient,
  expectedUserId: string,
): Promise<PreferenceChatMessage[]> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error('Not authenticated');
  if (auth.user.id !== expectedUserId) throw new Error('Session changed while loading preference chat.');

  const { data, error } = await client
    .from('preference_chat_messages')
    .select('id,sender,content,created_at')
    .eq('user_id', expectedUserId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  return [...(data ?? [])].reverse().flatMap(row => {
    if (row.sender !== 'user' && row.sender !== 'assistant') return [];
    return [{
      id: row.id,
      sender: row.sender,
      content: row.content,
      createdAt: new Date(row.created_at),
    } satisfies PreferenceChatMessage];
  });
}

export class OnboardingDraftConflictError extends Error {
  constructor(readonly currentRevision: number) {
    super('Bản nháp đã được cập nhật ở một phiên khác. Vui lòng tải lại để tiếp tục.');
    this.name = 'OnboardingDraftConflictError';
  }
}

interface OnboardingDraftRowShape {
  draft?: unknown;
  draft_revision?: unknown;
  analysis?: unknown;
  analysis_revision?: unknown;
  updated_at?: string | null;
}

function onboardingDraftFromRow(value: unknown): PersistedOnboardingDraft | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const data = row as OnboardingDraftRowShape;
  const draft = normalizeOnboardingDraft(data.draft);
  if (!draft) return null;
  return {
    draft,
    draftRevision: Number(data.draft_revision) || 0,
    analysis: data.analysis && typeof data.analysis === 'object' ? data.analysis as AIProfileAnalysis : null,
    analysisRevision: data.analysis_revision == null ? null : Number(data.analysis_revision),
    updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
  };
}

/** Loads the current user's owner-only onboarding draft. */
export async function getOnboardingDraft(
  client: FloveSupabaseClient,
  expectedUserId?: string,
): Promise<PersistedOnboardingDraft | null> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Not authenticated');
  if (expectedUserId && auth.user.id !== expectedUserId) {
    throw new Error('Session changed while loading onboarding draft.');
  }
  const { data, error } = await client
    .from('onboarding_drafts')
    .select('draft,draft_revision,analysis,analysis_revision,updated_at')
    .eq('user_id', expectedUserId ?? auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return onboardingDraftFromRow(data);
}

/**
 * Compare-and-swap draft persistence. The database RPC increments the revision
 * and clears any analysis atomically whenever answers change.
 */
export async function saveOnboardingDraft(
  client: FloveSupabaseClient,
  draft: OnboardingDraftV2,
  expectedRevision: number,
  expectedUserId?: string,
): Promise<PersistedOnboardingDraft> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  if (expectedUserId && auth.user.id !== expectedUserId) {
    throw new Error('Session changed while saving draft.');
  }

  const { data, error } = await client.rpc('save_onboarding_draft', {
    // The RPC accepts arbitrary JSON for the draft; Json is structurally open here.
    p_draft: draft as unknown as Json,
    p_expected_revision: expectedRevision > 0 ? expectedRevision : undefined,
    p_onboarding_version: draft.version,
    p_expected_user_id: expectedUserId ?? auth.user.id,
  });
  if (error) {
    const current = await getOnboardingDraft(client, expectedUserId).catch(() => null);
    if (current && current.draftRevision !== expectedRevision) {
      throw new OnboardingDraftConflictError(current.draftRevision);
    }
    throw error;
  }
  const saved = onboardingDraftFromRow(data);
  if (!saved) throw new Error('Backend returned an invalid onboarding draft.');
  return saved;
}

/**
 * Legacy batch reader. New clients use `ensureDailyMatches`, which resolves the
 * Vietnam business date server-side. Without an explicit date this returns only the
 * latest batch and is intended for the one-release legacy adapter.
 */
export async function getTodayMatches(client: FloveSupabaseClient, date?: string): Promise<DailyMatchBatch | null> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  let batchQuery = client
    .from('daily_match_batches')
    .select('*')
    .eq('user_id', auth.user.id);
  batchQuery = date ? batchQuery.eq('date', date) : batchQuery.order('date', { ascending: false }).limit(1);
  const { data: batch, error: batchError } = await batchQuery.maybeSingle();
  if (batchError) throw batchError;
  if (!batch) return null;

  const { data: matches, error: matchesError } = await client
    .from('curated_matches')
    .select('*')
    .eq('batch_id', batch.id)
    .eq('status', 'pending')
    .order('compatibility_score', { ascending: false });
  if (matchesError) throw matchesError;

  return dailyMatchBatchFromRows(batch, (matches ?? []).map(row => curatedMatchFromRow(row)));
}

export async function getCuratedMatch(client: FloveSupabaseClient, matchId: string): Promise<CuratedMatch> {
  const { data, error } = await client
    .from('curated_matches')
    .select('*')
    .eq('id', matchId)
    .single();
  if (error) throw error;
  return curatedMatchFromRow(data);
}
