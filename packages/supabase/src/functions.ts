import {
  isApiFailure,
  type AIProfileAnalysis,
  type ApiFailure,
  type AiPickAccessMode,
  type AiPickBatchAccessState,
  type DailyPick,
  type DailyMatchBatch,
  type DailyMatchesResult,
  type LockedDailyPick,
  type MatchFeedbackDecision,
  type OnboardingAnswerInput,
  type OnboardingBasicInput,
  type OnboardingReviewEdits,
  type RevealedDailyPick,
  type UserProfile,
} from '@flove/core';
import type { FloveSupabaseClient } from './client';
import { userProfileFromRow } from './mappers';

export type { OnboardingAnswerInput, OnboardingBasicInput, OnboardingReviewEdits } from '@flove/core';

export type AnalyzeOnboardingProfileInput =
  | { draftRevision: number; expectedUserId: string }
  | { answers: OnboardingAnswerInput[]; basic: OnboardingBasicInput };

export type ConfirmOnboardingProfileInput =
  | {
      draftRevision: number;
      analysisRevision: number;
      reviewEdits: OnboardingReviewEdits;
      expectedUserId: string;
    }
  | { analysis: AIProfileAnalysis; basic: OnboardingBasicInput; answers: OnboardingAnswerInput[] };

export class ApiRequestError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId: string;
  readonly retryAfterMs?: number;

  constructor(failure: ApiFailure) {
    super(failure.error.message);
    this.name = 'ApiRequestError';
    this.code = failure.error.code;
    this.retryable = failure.error.retryable;
    this.requestId = failure.error.requestId;
    this.retryAfterMs = failure.retryAfterMs;
  }
}

export class DailyMatchesApiError extends ApiRequestError {
  constructor(failure: ApiFailure) {
    super(failure);
    this.name = 'DailyMatchesApiError';
  }
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function stringField(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(message);
  return value;
}

function textField(value: unknown, message: string): string {
  if (typeof value !== 'string') throw new Error(message);
  return value;
}

function finiteNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(message);
  return value;
}

function scoreField(value: unknown): number {
  const score = finiteNumber(value, 'Invalid compatibility score.');
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('Invalid compatibility score.');
  return score;
}

function dateField(value: unknown, message: string): Date {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) throw new Error(message);
  return date;
}

function stringArray(value: unknown, message: string): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) throw new Error(message);
  return value;
}

function revealedPickFromPayload(value: unknown): RevealedDailyPick {
  const match = record(value, 'Invalid revealed daily pick.');
  if (match.kind !== 'revealed') throw new Error('Invalid revealed daily pick kind.');
  const candidate = record(match.candidate, 'Invalid revealed daily pick candidate.');
  const rawProfileText = record(candidate.profileText, 'Invalid revealed candidate profile text.');
  const profileText: RevealedDailyPick['candidate']['profileText'] = {
    bio: textField(rawProfileText.bio, 'Invalid revealed candidate profile bio.'),
  };
  for (const key of ['school', 'majorLabel', 'weekendStyle', 'conversationStyle', 'memorableThing', 'relationshipIntent'] as const) {
    if (rawProfileText[key] != null) profileText[key] = textField(rawProfileText[key], `Invalid profile text field: ${key}.`);
  }
  const status = String(match.status);
  if (!['pending', 'accepted', 'declined', 'skipped', 'reported', 'matched'].includes(String(match.status))) {
    throw new Error('Invalid revealed pick status.');
  }
  const gender = candidate.gender == null
    ? undefined
    : ['male', 'female', 'other', 'prefer_not_to_show'].includes(String(candidate.gender))
      ? candidate.gender as RevealedDailyPick['candidate']['gender']
      : (() => { throw new Error('Invalid revealed candidate gender.'); })();
  const heightCm = candidate.heightCm == null
    ? candidate.heightCm as null | undefined
    : finiteNumber(candidate.heightCm, 'Invalid revealed candidate height.');
  return {
    kind: 'revealed',
    id: stringField(match.id, 'Invalid revealed match id.'),
    batchId: stringField(match.batchId, 'Invalid revealed batch id.'),
    userId: stringField(match.userId, 'Invalid revealed owner id.'),
    candidateId: stringField(match.candidateId, 'Invalid revealed candidate id.'),
    candidate: {
      id: stringField(candidate.id, 'Invalid revealed candidate id.'),
      name: stringField(candidate.name, 'Invalid revealed candidate name.'),
      age: finiteNumber(candidate.age, 'Invalid revealed candidate age.'),
      major: stringField(candidate.major, 'Invalid revealed candidate major.') as RevealedDailyPick['candidate']['major'],
      campus: stringField(candidate.campus, 'Invalid revealed candidate campus.') as RevealedDailyPick['candidate']['campus'],
      avatarUrl: textField(candidate.avatarUrl, 'Invalid revealed candidate avatar.'),
      bio: textField(candidate.bio, 'Invalid revealed candidate bio.'),
      interests: stringArray(candidate.interests, 'Invalid revealed candidate interests.'),
      personalityTags: stringArray(candidate.personalityTags, 'Invalid revealed candidate personality tags.'),
      datingGoals: stringArray(candidate.datingGoals, 'Invalid revealed candidate dating goals.'),
      preferredVibes: stringArray(candidate.preferredVibes, 'Invalid revealed candidate preferred vibes.'),
      profileText,
      profileCompleteness: finiteNumber(candidate.profileCompleteness, 'Invalid revealed profile completeness.'),
      ...(gender ? { gender } : {}),
      ...(heightCm !== undefined ? { heightCm } : {}),
    },
    pairKey: stringField(match.pairKey, 'Invalid revealed pair key.'),
    aiReason: textField(match.aiReason, 'Invalid AI reason.'),
    ...(match.suggestedOpener == null ? {} : { suggestedOpener: textField(match.suggestedOpener, 'Invalid suggested opener.') }),
    compatibilityLabel: stringField(match.compatibilityLabel, 'Invalid compatibility label.'),
    compatibilityScore: scoreField(match.compatibilityScore),
    status: status as RevealedDailyPick['status'],
    feedbackTags: stringArray(match.feedbackTags, 'Invalid feedback tags.'),
    ...(match.feedbackNote == null ? {} : { feedbackNote: textField(match.feedbackNote, 'Invalid feedback note.') }),
    createdAt: dateField(match.createdAt, 'Invalid revealed pick timestamp.'),
    ...(match.decidedAt == null ? {} : { decidedAt: dateField(match.decidedAt, 'Invalid revealed decision timestamp.') }),
  };
}

const LOCKED_PICK_KEYS = new Set(['kind', 'previewId', 'compatibilityScore', 'compatibilityLabel']);

function lockedPickFromPayload(value: unknown): LockedDailyPick {
  const match = record(value, 'Invalid locked daily pick.');
  if (match.kind !== 'locked') throw new Error('Invalid locked daily pick kind.');
  const unexpected = Object.keys(match).find(key => !LOCKED_PICK_KEYS.has(key));
  if (unexpected) throw new Error(`Locked daily pick leaked forbidden field: ${unexpected}.`);
  return {
    kind: 'locked',
    previewId: stringField(match.previewId, 'Invalid locked preview id.'),
    compatibilityScore: scoreField(match.compatibilityScore),
    compatibilityLabel: stringField(match.compatibilityLabel, 'Invalid compatibility label.'),
  };
}

function dailyPickFromPayload(value: unknown): DailyPick {
  const match = record(value, 'Invalid daily pick.');
  if (match.kind === 'revealed') return revealedPickFromPayload(match);
  if (match.kind === 'locked') return lockedPickFromPayload(match);
  throw new Error('Unknown daily pick kind.');
}

function accessFromPayload(value: unknown) {
  const access = record(value, 'Invalid daily match access metadata.');
  if (access.mode !== 'open' && access.mode !== 'stub') throw new Error('Invalid AI Picks access mode.');
  if (!['teaser', 'locked', 'unlocked'].includes(String(access.state))) {
    throw new Error('Invalid AI Picks access state.');
  }
  const lockedCount = finiteNumber(access.lockedCount, 'Invalid locked pick count.');
  const priceVnd = finiteNumber(access.priceVnd, 'Invalid AI Picks price.');
  if (!Number.isInteger(lockedCount) || lockedCount < 0 || priceVnd < 0) {
    throw new Error('Invalid AI Picks access metadata.');
  }
  return {
    mode: access.mode as AiPickAccessMode,
    state: access.state as AiPickBatchAccessState,
    priceVnd,
    lockedCount,
  };
}

function hydrateBatch(value: unknown): DailyMatchBatch {
  const batch = record(value, 'Invalid daily match batch.');
  if (!Array.isArray(batch.matches)) throw new Error('Invalid daily match list.');
  const parsedPicks = batch.matches.map(dailyPickFromPayload);
  const picks = parsedPicks.filter(match => (
    match.kind === 'locked' || match.status === 'pending'
  ));
  const access = accessFromPayload(batch);
  if (parsedPicks.filter(match => match.kind === 'locked').length !== access.lockedCount) {
    throw new Error('Locked pick count does not match the payload.');
  }
  const revealedCount = parsedPicks.filter(match => match.kind === 'revealed').length;
  if (access.mode === 'open' && (access.state !== 'unlocked' || access.lockedCount !== 0)) {
    throw new Error('Open AI Picks must reveal the full batch.');
  }
  if (access.state === 'unlocked' && access.lockedCount !== 0) {
    throw new Error('Unlocked AI Picks cannot contain locked previews.');
  }
  if (access.state === 'locked' && revealedCount !== 0) {
    throw new Error('A locked AI Picks batch cannot contain revealed profiles.');
  }
  if (access.state === 'teaser' && revealedCount > 1) {
    throw new Error('A teaser AI Picks batch can reveal at most one profile.');
  }
  return {
    id: stringField(batch.id, 'Invalid daily batch id.'),
    userId: stringField(batch.userId, 'Invalid daily batch owner.'),
    date: stringField(batch.date, 'Invalid daily batch date.'),
    createdAt: dateField(batch.createdAt, 'Invalid daily batch timestamp.'),
    matches: picks,
    ...access,
  };
}

/** Runtime boundary for an untyped Edge Function payload. */
export function dailyMatchesResultFromPayload(payload: unknown): DailyMatchesResult {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid daily matches response.');
  const result = payload as Record<string, unknown>;
  switch (result.status) {
    case 'ready':
      if (!result.batch || !result.businessDate) throw new Error('Invalid ready daily matches response.');
      if (result.source !== 'cached' && result.source !== 'generated') throw new Error('Invalid ready source.');
      return {
        status: 'ready',
        businessDate: stringField(result.businessDate, 'Invalid business date.'),
        source: result.source,
        batch: hydrateBatch(result.batch),
      };
    case 'processing':
      if (!result.businessDate || !Number.isFinite(result.retryAfterMs)) throw new Error('Invalid processing response.');
      return {
        status: 'processing',
        businessDate: stringField(result.businessDate, 'Invalid business date.'),
        retryAfterMs: finiteNumber(result.retryAfterMs, 'Invalid processing retry delay.'),
      };
    case 'empty':
      if (!result.businessDate || !result.retryAfterAt) throw new Error('Invalid empty response.');
      if (result.reason !== 'all_recently_seen' && result.reason !== 'no_eligible_candidates') {
        throw new Error('Invalid empty response reason.');
      }
      return {
        status: 'empty',
        businessDate: stringField(result.businessDate, 'Invalid business date.'),
        reason: result.reason,
        retryAfterAt: stringField(result.retryAfterAt, 'Invalid retry timestamp.'),
      };
    case 'needs_onboarding':
      if (!Array.isArray(result.missing)) throw new Error('Invalid onboarding response.');
      return { status: 'needs_onboarding', missing: result.missing as never };
    default:
      throw new Error('Unknown daily matches response status.');
  }
}

async function failureFromInvokeError(error: unknown): Promise<ApiFailure | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof (context as { clone?: unknown }).clone !== 'function') return null;
  try {
    const cloned = (context as { clone(): { json(): Promise<unknown> } }).clone();
    const payload: unknown = await cloned.json();
    return isApiFailure(payload) ? payload : null;
  } catch {
    return null;
  }
}

export async function ensureDailyMatches(
  client: FloveSupabaseClient,
  expectedUserId?: string,
): Promise<DailyMatchesResult> {
  const { data, error } = await client.functions.invoke('ensure-daily-matches', {
    body: expectedUserId ? { expectedUserId } : {},
  });
  if (error) {
    const failure = await failureFromInvokeError(error);
    if (failure) throw new DailyMatchesApiError(failure);
    throw error;
  }
  if (isApiFailure(data)) throw new DailyMatchesApiError(data);
  return dailyMatchesResultFromPayload(data);
}

export interface UnlockDailyMatchBatchResult {
  batchId: string;
  productMode: AiPickAccessMode;
  accessState: AiPickBatchAccessState;
  priceVnd: number;
  applied: boolean;
  unlockSource: 'open' | 'trial' | 'simulated';
}

/** Opens an entire AI Picks batch. The current backend records only simulated unlocks. */
export async function unlockDailyMatchBatch(
  client: FloveSupabaseClient,
  input: { batchId: string; idempotencyKey: string; expectedUserId: string },
): Promise<UnlockDailyMatchBatchResult> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error('Not authenticated');
  if (auth.user.id !== input.expectedUserId) {
    throw new Error('Session changed while unlocking AI Picks.');
  }
  const { data, error } = await client.rpc('unlock_daily_match_batch' as never, {
    p_batch_id: input.batchId,
    p_idempotency_key: input.idempotencyKey,
    p_expected_user_id: input.expectedUserId,
  } as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('Invalid AI Picks unlock response.');
  const result = row as Record<string, unknown>;
  if (result.product_mode !== 'open' && result.product_mode !== 'stub') {
    throw new Error('Invalid AI Picks unlock mode.');
  }
  if (!['teaser', 'locked', 'unlocked'].includes(String(result.access_state))) {
    throw new Error('Invalid AI Picks unlock state.');
  }
  if (!['open', 'trial', 'simulated'].includes(String(result.unlock_source))) {
    throw new Error('Invalid AI Picks unlock source.');
  }
  if (typeof result.applied !== 'boolean') throw new Error('Invalid AI Picks unlock result.');
  const priceVnd = finiteNumber(result.price_vnd, 'Invalid AI Picks price.');
  if (!Number.isInteger(priceVnd) || priceVnd < 0) throw new Error('Invalid AI Picks price.');
  return {
    batchId: stringField(result.batch_id, 'Invalid unlocked batch id.'),
    productMode: result.product_mode,
    accessState: result.access_state as AiPickBatchAccessState,
    priceVnd,
    applied: result.applied,
    unlockSource: result.unlock_source as UnlockDailyMatchBatchResult['unlockSource'],
  };
}

/** @deprecated Use `ensureDailyMatches`; the backend owns the Vietnam business date. */
export async function generateDailyMatches(client: FloveSupabaseClient, _date?: string): Promise<DailyMatchesResult> {
  const { data, error } = await client.functions.invoke('generate-daily-matches', { body: {} });
  if (error) {
    const failure = await failureFromInvokeError(error);
    if (failure) throw new DailyMatchesApiError(failure);
    throw error;
  }
  if (isApiFailure(data)) throw new DailyMatchesApiError(data);
  return dailyMatchesResultFromPayload(data);
}

async function throwFunctionError(error: unknown): Promise<never> {
  const failure = await failureFromInvokeError(error);
  if (failure) throw new ApiRequestError(failure);
  throw error instanceof Error ? error : new Error('Backend request failed.');
}

export type BlindDateClaimResult =
  | { ok: true; waiting: true; sessionId: null }
  | {
      ok: true;
      waiting: false;
      sessionId: string;
      conversationId: string;
      partnerMaskedName: string;
    };

export interface BlindDateSessionResult {
  sessionId: string;
  conversationId: string;
  partnerMaskedName: string;
  requestedByMe: boolean;
  requestedByPartner: boolean;
  isRevealed: boolean;
  /** Available only after both participants atomically accept reveal. */
  partnerId: string | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  isMine: boolean;
}

export interface ConversationReadResult {
  conversationId: string;
  unreadCount: number;
  markedReadCount: number;
  applied: boolean;
}

function blindDateSessionFromRow(row: {
  session_id: string;
  conversation_id: string;
  partner_masked_name: string;
  requested_by_me: boolean;
  requested_by_partner: boolean;
  is_revealed: boolean;
  partner_id: string | null;
}): BlindDateSessionResult {
  return {
    sessionId: row.session_id,
    conversationId: row.conversation_id,
    partnerMaskedName: row.partner_masked_name,
    requestedByMe: row.requested_by_me,
    requestedByPartner: row.requested_by_partner,
    isRevealed: row.is_revealed,
    partnerId: row.is_revealed ? row.partner_id : null,
  };
}

/** Claims a Blind Date without ever returning the counterpart's profile ID. */
export async function findBlindDatePartner(
  client: FloveSupabaseClient,
  expectedUserId?: string,
): Promise<BlindDateClaimResult> {
  const { data, error } = await client.functions.invoke('find-blind-date-partner', {
    body: expectedUserId ? { expectedUserId } : {},
  });
  if (error) return throwFunctionError(error);
  if (isApiFailure(data)) throw new ApiRequestError(data);

  const result = data as Record<string, unknown>;
  if (result.waiting === true) {
    return { ok: true, waiting: true, sessionId: null };
  }
  if (
    typeof result.sessionId !== 'string'
    || typeof result.conversationId !== 'string'
  ) {
    throw new Error('Invalid Blind Date response.');
  }
  return {
    ok: true,
    waiting: false,
    sessionId: result.sessionId,
    conversationId: result.conversationId,
    partnerMaskedName: String(result.partnerMaskedName ?? 'Người ẩn danh'),
  };
}

/** Reads participant-safe state; partnerId stays null until mutual reveal. */
export async function getBlindDateSession(
  client: FloveSupabaseClient,
  sessionId: string,
): Promise<BlindDateSessionResult> {
  const { data, error } = await client.rpc('get_blind_date_session', {
    p_session_id: sessionId,
  });
  if (error) throw new Error('Chưa tải được phiên Blind Date.');
  const row = data?.[0];
  if (!row) throw new Error('Blind Date session not found.');
  return blindDateSessionFromRow(row);
}

/** Resolves reload-safe Blind Date state from an opaque conversation ID. */
export async function getBlindDateSessionForConversation(
  client: FloveSupabaseClient,
  conversationId: string,
): Promise<BlindDateSessionResult | null> {
  const { data, error } = await client.rpc('get_blind_date_session_for_conversation', {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error('Chưa tải được phiên Blind Date.');
  const row = data?.[0];
  return row ? blindDateSessionFromRow(row) : null;
}

/** Requests mutual reveal; counterpart identity is returned only after acceptance. */
export async function requestBlindDateReveal(
  client: FloveSupabaseClient,
  sessionId: string,
  expectedUserId?: string,
) {
  const { data, error } = await client.functions.invoke('request-reveal', {
    body: { sessionId, ...(expectedUserId ? { expectedUserId } : {}) },
  });
  if (error) return throwFunctionError(error);
  if (isApiFailure(data)) throw new ApiRequestError(data);
  const result = data as { accepted?: unknown; isRevealed?: unknown; partnerId?: unknown };
  const isRevealed = result.isRevealed === true;
  return {
    ok: true as const,
    accepted: result.accepted === true,
    isRevealed,
    partnerId: isRevealed && typeof result.partnerId === 'string' ? result.partnerId : null,
  };
}

/** Returns relative message ownership, never sender UUIDs or idempotency keys. */
export async function listConversationMessages(
  client: FloveSupabaseClient,
  conversationId: string,
  limit = 200,
): Promise<ConversationMessage[]> {
  const { data, error } = await client.rpc('list_conversation_messages', {
    p_conversation_id: conversationId,
    p_limit: limit,
  });
  if (error) throw new Error('Chưa tải được cuộc trò chuyện.');
  return (data ?? []).map(row => ({
    id: row.id,
    conversationId: row.conversation_id,
    content: row.content,
    createdAt: row.created_at,
    isRead: row.is_read,
    isMine: row.is_mine,
  }));
}

/** Atomically clears the caller's badge and marks counterpart messages read. */
export async function markConversationRead(
  client: FloveSupabaseClient,
  conversationId: string,
): Promise<ConversationReadResult> {
  const { data, error } = await client.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error('Chưa cập nhật được trạng thái đã đọc.');
  const row = data?.[0];
  if (!row) throw new Error('Invalid conversation read response.');
  return {
    conversationId: row.conversation_id,
    unreadCount: row.unread_count,
    markedReadCount: row.marked_read_count,
    applied: row.applied,
  };
}

/** Analyzes the exact persisted draft revision and stores it server-side. */
export async function analyzeOnboardingProfile(
  client: FloveSupabaseClient,
  input: AnalyzeOnboardingProfileInput,
) {
  const { data, error } = await client.functions.invoke('analyze-onboarding-profile', {
    body: input,
  });
  if (error) return throwFunctionError(error);
  if (isApiFailure(data)) throw new ApiRequestError(data);
  return data as {
    ok: true;
    analysis: AIProfileAnalysis;
    generatedBy: string;
    draftRevision: number;
    analysisRevision: number;
  };
}

/** Confirms only a server-owned analysis matching the persisted draft revision. */
export async function confirmOnboardingProfile(
  client: FloveSupabaseClient,
  input: ConfirmOnboardingProfileInput,
) {
  const { data, error } = await client.functions.invoke('confirm-onboarding-profile', {
    body: input,
  });
  if (error) return throwFunctionError(error);
  if (isApiFailure(data)) throw new ApiRequestError(data);
  const result = data as {
    ok: true;
    profileCompleteness: number;
    profileRevision: number;
    embeddingStatus: string;
    profile: unknown;
  };
  return {
    ...result,
    profile: userProfileFromRow(result.profile as never) as UserProfile,
  };
}

export async function submitMatchFeedback(
  client: FloveSupabaseClient,
  input: {
    matchId: string;
    decision: Exclude<MatchFeedbackDecision, 'accepted'>;
    tags?: string[];
    note?: string;
    idempotencyKey?: string;
    expectedUserId?: string;
  }
) {
  const { data, error } = await client.functions.invoke('submit-match-feedback', {
    body: input,
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : undefined,
  });
  if (error) return throwFunctionError(error);
  if (isApiFailure(data)) throw new ApiRequestError(data);
  return data as { ok: true };
}

export async function acceptCuratedMatch(
  client: FloveSupabaseClient,
  input: {
    matchId: string;
    tags?: string[];
    note?: string;
    idempotencyKey?: string;
    expectedUserId?: string;
  }
) {
  const { data, error } = await client.functions.invoke('accept-curated-match', {
    body: input,
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : undefined,
  });
  if (error) return throwFunctionError(error);
  if (isApiFailure(data)) throw new ApiRequestError(data);
  return data as { ok: true; isMutual: boolean; conversationId?: string };
}

export interface PreferenceCoachResult {
  ok: true;
  applied: boolean;
  reply: string;
  summary: string;
  preferredTraits: string[];
  avoidedTraits: string[];
  fallback: boolean;
  llmEligible?: boolean;
}

export async function sendPreferenceChatMessage(
  client: FloveSupabaseClient,
  content: string,
  idempotencyKey?: string,
  expectedUserId?: string,
) {
  const { data, error } = await client.functions.invoke('send-preference-chat-message', {
    body: { content, idempotencyKey, ...(expectedUserId ? { expectedUserId } : {}) },
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
  if (error) return throwFunctionError(error);
  if (isApiFailure(data)) throw new ApiRequestError(data);
  return data as PreferenceCoachResult;
}
