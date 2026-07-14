import {
  isApiFailure,
  type AIProfileAnalysis,
  type ApiFailure,
  type CuratedMatch,
  type DailyMatchBatch,
  type DailyMatchesResult,
  type MatchFeedbackDecision,
  type OnboardingAnswerInput,
  type OnboardingBasicInput,
  type OnboardingReviewEdits,
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

function asDate(value: unknown): Date {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function hydrateMatch(match: CuratedMatch): CuratedMatch {
  return {
    ...match,
    createdAt: asDate(match.createdAt),
    ...(match.decidedAt ? { decidedAt: asDate(match.decidedAt) } : {}),
  };
}

function hydrateBatch(batch: DailyMatchBatch): DailyMatchBatch {
  return {
    ...batch,
    createdAt: asDate(batch.createdAt),
    matches: (batch.matches ?? []).filter(match => match.status === 'pending').map(hydrateMatch),
  };
}

/** Runtime boundary for an untyped Edge Function payload. */
export function dailyMatchesResultFromPayload(payload: unknown): DailyMatchesResult {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid daily matches response.');
  const result = payload as DailyMatchesResult;
  switch (result.status) {
    case 'ready':
      if (!result.batch || !result.businessDate) throw new Error('Invalid ready daily matches response.');
      return { ...result, batch: hydrateBatch(result.batch) };
    case 'processing':
      if (!result.businessDate || !Number.isFinite(result.retryAfterMs)) throw new Error('Invalid processing response.');
      return result;
    case 'empty':
      if (!result.businessDate || !result.retryAfterAt) throw new Error('Invalid empty response.');
      return result;
    case 'needs_onboarding':
      if (!Array.isArray(result.missing)) throw new Error('Invalid onboarding response.');
      return result;
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
  return data as { ok: true; applied: boolean };
}
