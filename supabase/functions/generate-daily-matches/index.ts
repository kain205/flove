import { createServiceClient, errorResponse, expectedUserFenceResponse, jsonObjectBody, jsonResponse, requireUser } from '../_shared/client.ts';
import { kickAiWorker } from '../_shared/ai-jobs.ts';
import {
  compatibilityLabel,
  deterministicScoreComponents,
  scoreFromComponents,
  toCompatibilityScore,
  type DeterministicMatchProfile,
} from '../_shared/scoring.ts';

const algorithmVersion = 'deterministic-v2';
const candidatePoolLimit = 120;
const dailyPickLimit = 5;
const processingRetryMs = 1_500;
const emptyRetrySeconds = 15 * 60;
const recentlySeenRetrySeconds = 60 * 60;

type JsonObject = Record<string, any>;

interface ClaimRow {
  result: 'claimed' | 'cached' | 'processing' | 'empty' | 'needs_onboarding';
  business_date: string;
  batch_id: string;
  batch_status: 'generating' | 'ready' | 'empty' | 'failed';
  claim_token: string | null;
  attempt_count: number;
  retry_after: string | null;
  missing_requirements: string[] | null;
}

type StageTimings = Record<string, number>;

async function timed<T>(stages: StageTimings, stage: string, task: () => PromiseLike<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    return await task();
  } finally {
    stages[stage] = Date.now() - startedAt;
  }
}

function firstRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function finite(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function array(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
}

function signalsFrom(row: JsonObject): JsonObject | null {
  const analysis = object(row.ai_profile_analysis);
  const signals = analysis.matchingSignals ?? analysis.matching_signals;
  return signals && typeof signals === 'object' && !Array.isArray(signals) ? signals : null;
}

function scoringProfile(row: JsonObject): DeterministicMatchProfile {
  return {
    id: String(row.id),
    campus: typeof row.campus === 'string' ? row.campus : undefined,
    major: typeof row.major === 'string' ? row.major : undefined,
    appearancePreference: object(row.appearance_preference),
    dealbreakers: Array.isArray(row.dealbreakers) ? row.dealbreakers : [],
    signals: signalsFrom(row),
    interests: array(row.interests),
  };
}

function mutualPreference(row: JsonObject): number | undefined {
  const selfToCandidate = Math.max(0, finite(row.preference_to_candidate));
  const candidateToSelf = Math.max(0, finite(row.candidate_to_preference));
  if (selfToCandidate === 0 && candidateToSelf === 0) return undefined;
  return Math.sqrt(selfToCandidate * candidateToSelf);
}

function publicSnapshot(row: JsonObject) {
  return {
    id: String(row.id),
    name: String(row.name ?? 'FPT Student'),
    age: finite(row.age),
    major: String(row.major ?? 'SE'),
    campus: String(row.campus ?? 'HCM'),
    gender: row.gender ?? null,
    height_cm: row.height_cm ?? null,
    avatar_url: String(row.avatar_url ?? ''),
    bio: String(row.bio ?? ''),
    interests: array(row.interests),
    personality_tags: array(row.personality_tags),
    dating_goals: array(row.dating_goals),
    preferred_vibes: array(row.preferred_vibes),
    profile_text: object(row.profile_text),
    profile_completeness: finite(row.profile_completeness),
  };
}

function campusLabel(campus: string) {
  const labels: Record<string, string> = {
    HCM: 'TP. Hồ Chí Minh',
    Hanoi: 'Hà Nội',
    Danang: 'Đà Nẵng',
    Cantho: 'Cần Thơ',
  };
  return labels[campus] ?? campus;
}

function fallbackInsights(self: JsonObject, candidate: JsonObject): string[] {
  const insights: string[] = [];
  const selfInterests = new Set(array(self.interests).map(item => item.toLocaleLowerCase()));
  const shared = array(candidate.interests).filter(item => selfInterests.has(item.toLocaleLowerCase()));
  if (shared.length > 0) insights.push(`Hai bạn cùng quan tâm ${shared.slice(0, 2).join(' và ')}, dễ bắt đầu câu chuyện tự nhiên.`);
  if (self.campus === candidate.campus) insights.push(`Cùng học tại ${campusLabel(String(candidate.campus))}, thuận tiện để tìm hiểu ngoài đời.`);
  const selfGoals = new Set(array(self.dating_goals));
  const sharedGoals = array(candidate.dating_goals).filter(goal => selfGoals.has(goal));
  if (sharedGoals.length > 0) insights.push(`Cả hai cùng hướng tới ${sharedGoals.slice(0, 2).join(' và ')}.`);
  const vibes = array(candidate.preferred_vibes);
  if (insights.length < 3 && vibes.length > 0) insights.push(`Vibe nổi bật của bạn ấy là ${vibes.slice(0, 2).join(' và ')}.`);
  if (insights.length === 0) insights.push(`Hồ sơ của ${String(candidate.name ?? 'bạn ấy')} mang đến một góc nhìn mới đáng khám phá.`);
  return insights.slice(0, 3);
}

function fallbackReason(self: JsonObject, candidate: JsonObject): string {
  return fallbackInsights(self, candidate).map(reason => `✦ ${reason}`).join('\n');
}

function fallbackOpener(self: JsonObject, candidate: JsonObject): string {
  const selfInterests = new Set(array(self.interests).map(item => item.toLocaleLowerCase()));
  const shared = array(candidate.interests).find(item => selfInterests.has(item.toLocaleLowerCase()));
  return shared
    ? `Chào ${String(candidate.name ?? 'bạn')}, mình thấy tụi mình đều thích ${shared}. Bạn bắt đầu sở thích này từ khi nào vậy?`
    : `Chào ${String(candidate.name ?? 'bạn')}, mình thấy hồ sơ của bạn khá thú vị. Tuần này của bạn có điều gì vui không?`;
}

function publicProfileFromSnapshot(value: unknown) {
  const snapshot = object(value);
  const bio = String(snapshot.bio ?? '');
  return {
    id: String(snapshot.id ?? ''),
    name: String(snapshot.name ?? 'FPT Student'),
    age: finite(snapshot.age),
    major: String(snapshot.major ?? 'SE'),
    campus: String(snapshot.campus ?? 'HCM'),
    avatarUrl: String(snapshot.avatar_url ?? snapshot.avatarUrl ?? ''),
    bio,
    interests: array(snapshot.interests),
    personalityTags: array(snapshot.personality_tags ?? snapshot.personalityTags),
    datingGoals: array(snapshot.dating_goals ?? snapshot.datingGoals),
    preferredVibes: array(snapshot.preferred_vibes ?? snapshot.preferredVibes),
    profileText: { bio, ...object(snapshot.profile_text ?? snapshot.profileText) },
    profileCompleteness: finite(snapshot.profile_completeness ?? snapshot.profileCompleteness),
    gender: snapshot.gender ?? undefined,
    heightCm: snapshot.height_cm ?? snapshot.heightCm ?? null,
  };
}

function curatedMatchFromRow(row: JsonObject) {
  return {
    id: String(row.id),
    batchId: String(row.batch_id),
    userId: String(row.user_id),
    candidateId: String(row.candidate_id),
    candidate: publicProfileFromSnapshot(row.candidate_snapshot),
    pairKey: String(row.pair_key),
    aiReason: String(row.ai_reason ?? ''),
    suggestedOpener: row.suggested_opener ? String(row.suggested_opener) : undefined,
    compatibilityLabel: String(row.compatibility_label ?? ''),
    compatibilityScore: finite(row.compatibility_score),
    status: String(row.status ?? 'pending'),
    feedbackTags: array(row.feedback_tags),
    feedbackNote: row.feedback_note ? String(row.feedback_note) : undefined,
    createdAt: String(row.created_at),
    decidedAt: row.decided_at ? String(row.decided_at) : undefined,
  };
}

async function loadReadyBatch(admin: any, userId: string, batchId: string) {
  const [batchResult, matchesResult] = await Promise.all([
    admin.from('daily_match_batches').select('*').eq('id', batchId).eq('user_id', userId).single(),
    admin.rpc('get_daily_match_rows_v2', { p_user_id: userId, p_batch_id: batchId }),
  ]);
  const { data: batch, error: batchError } = batchResult;
  if (batchError) throw batchError;
  const { data: matches, error: matchesError } = matchesResult;
  if (matchesError) throw matchesError;

  return {
    id: String(batch.id),
    userId: String(batch.user_id),
    date: String(batch.date),
    matches: (matches ?? []).map((row: JsonObject) => curatedMatchFromRow(row)),
    createdAt: String(batch.created_at),
  };
}

async function loadEmptyResult(admin: any, userId: string, batchId: string, businessDate: string) {
  const { data, error } = await admin
    .from('daily_match_batches')
    .select('empty_reason,retry_after')
    .eq('id', batchId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    status: 'empty' as const,
    businessDate,
    reason: data?.empty_reason === 'all_recently_seen' ? 'all_recently_seen' : 'no_eligible_candidates',
    retryAfterAt: String(data?.retry_after ?? new Date(Date.now() + emptyRetrySeconds * 1_000).toISOString()),
  };
}

function retryDelay(retryAfter: string | null): number {
  if (!retryAfter) return processingRetryMs;
  const delay = new Date(retryAfter).getTime() - Date.now();
  return Number.isFinite(delay) ? Math.max(500, Math.min(5_000, delay)) : processingRetryMs;
}

function logOutcome(
  requestId: string,
  startedAt: number,
  outcome: string,
  fields: Record<string, unknown> = {},
) {
  console.log(JSON.stringify({
    event: 'daily_matches_outcome',
    requestId,
    outcome,
    durationMs: Date.now() - startedAt,
    ...fields,
  }));
}

async function persistCompletedDuration(
  admin: any,
  batchId: string,
  attemptCount: number,
  durationMs: number,
  requestId: string,
) {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1) return;
  const { error } = await admin
    .from('match_generation_attempts')
    .update({ duration_ms: Math.max(0, Math.min(2_147_483_647, durationMs)) })
    .eq('batch_id', batchId)
    .eq('attempt_no', attemptCount)
    .in('outcome', ['ready', 'empty']);
  if (error) {
    console.error(JSON.stringify({
      event: 'daily_matches_duration_persist_failed', requestId, batchId, code: error.code,
    }));
  }
}

function deferCompletedDuration(
  admin: any,
  batchId: string,
  attemptCount: number,
  durationMs: number,
  requestId: string,
) {
  const task = persistCompletedDuration(
    admin,
    batchId,
    attemptCount,
    durationMs,
    requestId,
  ).catch((error: unknown) => {
    console.error(JSON.stringify({
      event: 'daily_matches_duration_persist_failed',
      requestId,
      batchId,
      code: error instanceof Error ? error.name : 'unknown',
    }));
  });
  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
  }).EdgeRuntime;
  if (edgeRuntime) edgeRuntime.waitUntil(task);
  else void task;
}

function deferFilterMetrics(
  admin: any,
  userId: string,
  requestId: string,
  batchId: string,
  always: boolean,
) {
  const configuredRate = Number(Deno.env.get('MATCH_METRICS_SAMPLE_RATE') ?? '0.05');
  const sampleRate = Number.isFinite(configuredRate) ? Math.max(0, Math.min(1, configuredRate)) : 0.05;
  if (!always && Math.random() >= sampleRate) return;

  const task = admin.rpc('get_match_filter_metrics', {
    p_user_id: userId,
    p_cooldown_days: 30,
  }).then(({ data, error }: { data: unknown; error: { code?: string } | null }) => {
    if (error) {
      console.error(JSON.stringify({ event: 'daily_matches_filter_metrics_failed', requestId, batchId, code: error.code }));
      return;
    }
    console.log(JSON.stringify({
      event: 'daily_matches_filter_funnel',
      requestId,
      batchId,
      counts: data,
    }));
  }).catch((error: unknown) => {
    console.error(JSON.stringify({
      event: 'daily_matches_filter_metrics_failed',
      requestId,
      batchId,
      code: error instanceof Error ? error.name : 'unknown',
    }));
  });
  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
  }).EdgeRuntime;
  if (edgeRuntime) edgeRuntime.waitUntil(task);
}

async function failClaim(
  admin: any,
  batchId: string,
  claimToken: string,
  errorCode: string,
  candidateCount: number,
  startedAt: number,
) {
  await admin.rpc('fail_daily_match_batch', {
    p_batch_id: batchId,
    p_claim_token: claimToken,
    p_error_code: errorCode,
    p_retry_after_seconds: 60,
    p_candidate_count: candidateCount,
    p_duration_ms: Date.now() - startedAt,
  });
}

Deno.serve(async req => {
  const startedAt = Date.now();
  const stagesMs: StageTimings = {};
  const { user, requestId, response } = await timed(stagesMs, 'authenticate', () => requireUser(req));
  if (response) return response;
  const body = await timed(stagesMs, 'validateRequest', () => jsonObjectBody(req));
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId);
  if (fenceResponse) return fenceResponse;
  const admin = createServiceClient();

  const { data: claimData, error: claimError } = await timed(stagesMs, 'claim', () =>
    admin.rpc('claim_daily_match_batch', {
      p_user_id: user!.id,
      p_algorithm_version: algorithmVersion,
      p_stale_after_seconds: 120,
    }));
  if (claimError) {
    console.error(JSON.stringify({
      event: 'daily_matches_claim_failed', requestId, code: claimError.code,
      durationMs: Date.now() - startedAt, stagesMs,
    }));
    return errorResponse(requestId, 'matching_claim_failed', 'Không thể chuẩn bị gợi ý lúc này.', 503, true, 2_000);
  }

  const claim = firstRow(claimData) as ClaimRow | null;
  if (!claim) return errorResponse(requestId, 'invalid_claim_result', 'Phản hồi matching không hợp lệ.', 500, true, 2_000);

  if (claim.result === 'needs_onboarding') {
    logOutcome(requestId, startedAt, 'needs_onboarding', {
      businessDate: claim.business_date,
      missingCount: claim.missing_requirements?.length ?? 0,
      stagesMs,
    });
    return jsonResponse({ status: 'needs_onboarding', missing: claim.missing_requirements ?? [] }, 200, requestId);
  }
  if (claim.result === 'processing') {
    logOutcome(requestId, startedAt, 'processing', {
      businessDate: claim.business_date, batchId: claim.batch_id, stagesMs,
    });
    return jsonResponse({ status: 'processing', businessDate: claim.business_date, retryAfterMs: retryDelay(claim.retry_after) }, 200, requestId);
  }
  if (claim.result === 'empty') {
    try {
      const result = await timed(stagesMs, 'load', () =>
        loadEmptyResult(admin, user!.id, claim.batch_id, claim.business_date));
      deferFilterMetrics(admin, user!.id, requestId, claim.batch_id, true);
      logOutcome(requestId, startedAt, 'empty', {
        businessDate: claim.business_date,
        batchId: claim.batch_id,
        source: 'cached',
        reason: result.reason,
        stagesMs,
      });
      return jsonResponse(result, 200, requestId);
    } catch {
      console.error(JSON.stringify({
        event: 'daily_matches_empty_load_failed', requestId, batchId: claim.batch_id,
        durationMs: Date.now() - startedAt, stagesMs,
      }));
      return errorResponse(requestId, 'matching_load_failed', 'Không thể tải trạng thái gợi ý.', 503, true, 1_500);
    }
  }
  if (claim.result === 'cached') {
    try {
      const batch = await timed(stagesMs, 'load', () => loadReadyBatch(admin, user!.id, claim.batch_id));
      logOutcome(requestId, startedAt, 'ready', {
        businessDate: claim.business_date,
        batchId: claim.batch_id,
        source: 'cached',
        matchCount: batch.matches.length,
        stagesMs,
      });
      return jsonResponse({ status: 'ready', businessDate: claim.business_date, batch, source: 'cached' }, 200, requestId);
    } catch {
      console.error(JSON.stringify({
        event: 'daily_matches_cached_load_failed', requestId, batchId: claim.batch_id,
        durationMs: Date.now() - startedAt, stagesMs,
      }));
      return errorResponse(requestId, 'matching_load_failed', 'Không thể tải gợi ý đã tạo.', 503, true, 1_500);
    }
  }

  if (!claim.claim_token) return errorResponse(requestId, 'missing_claim_token', 'Không thể khóa batch matching.', 500, true, 2_000);

  let candidateCount = 0;
  try {
    const [profileResult, candidatesResult] = await timed(stagesMs, 'candidates', () => Promise.all([
      admin.from('profiles').select('id,campus,major,appearance_preference,dealbreakers,ai_profile_analysis,interests,dating_goals').eq('id', user!.id).single(),
      admin.rpc('get_match_candidates_v2', { p_user_id: user!.id, p_limit: candidatePoolLimit, p_cooldown_days: 30 }),
    ]));
    if (profileResult.error) throw new Error(`self_profile:${profileResult.error.code ?? 'query_failed'}`);
    if (candidatesResult.error) throw new Error(`candidates:${candidatesResult.error.code ?? 'query_failed'}`);

    const self = profileResult.data as JsonObject;
    const selfProfile = scoringProfile(self);
    const candidates = (candidatesResult.data ?? []) as JsonObject[];
    candidateCount = candidates.length;
    deferFilterMetrics(admin, user!.id, requestId, claim.batch_id, candidateCount === 0);

    let emptyReason: 'no_eligible_candidates' | 'all_recently_seen' | null = null;
    if (candidateCount === 0) {
      // The normal query includes the 30-day cooldown. A one-row no-history probe
      // distinguishes a genuinely empty pool from candidates seen recently.
      const { data: withoutHistory, error: probeError } = await timed(stagesMs, 'historyProbe', () =>
        admin.rpc('get_match_candidates_v2', {
          p_user_id: user!.id,
          p_limit: 1,
          p_cooldown_days: 0,
        }));
      if (probeError) throw new Error(`candidate_probe:${probeError.code ?? 'query_failed'}`);
      emptyReason = (withoutHistory?.length ?? 0) > 0 ? 'all_recently_seen' : 'no_eligible_candidates';
    }

    const rankStartedAt = Date.now();
    const ranked = candidates
      .map(row => {
        const candidate = scoringProfile(row);
        const components = deterministicScoreComponents(selfProfile, candidate, {
          mutualPreference: mutualPreference(row),
          need: finite(row.need_similarity),
          communication: finite(row.communication_similarity),
          lifestyle: finite(row.lifestyle_similarity),
          selfSimilarity: finite(row.self_similarity),
          feedbackAdjustment: finite(row.feedback_affinity),
        });
        return {
          row,
          score: toCompatibilityScore(scoreFromComponents(components), self.campus === row.campus),
          coarseScore: finite(row.coarse_score),
        };
      })
      .sort((a, b) => b.score - a.score || b.coarseScore - a.coarseScore || String(a.row.id).localeCompare(String(b.row.id)))
      .slice(0, dailyPickLimit);

    const matches = ranked.map(({ row, score }) => ({
      candidate_id: String(row.id),
      candidate_snapshot: publicSnapshot(row),
      ai_reason: fallbackReason(self, row),
      compatibility_label: compatibilityLabel(score),
      compatibility_score: score,
      suggested_opener: fallbackOpener(self, row),
    }));
    stagesMs.rank = Date.now() - rankStartedAt;
    emptyReason = matches.length === 0 ? (emptyReason ?? 'no_eligible_candidates') : null;

    const { data: finalizeData, error: finalizeError } = await timed(stagesMs, 'finalize', () =>
      admin.rpc('finalize_daily_match_batch', {
        p_batch_id: claim.batch_id,
        p_user_id: user!.id,
        p_claim_token: claim.claim_token,
        p_matches: matches,
        p_generated_by: algorithmVersion,
        p_empty_reason: emptyReason,
        p_empty_retry_seconds: emptyReason === 'all_recently_seen' ? recentlySeenRetrySeconds : emptyRetrySeconds,
        p_candidate_count: candidateCount,
        p_duration_ms: Date.now() - startedAt,
      }));
    if (finalizeError) throw new Error(`finalize:${finalizeError.code ?? 'rpc_failed'}`);
    const finalized = firstRow(finalizeData) as { batch_status?: string } | null;
    if (matches.length > 0) kickAiWorker();

    if (matches.length === 0) {
      const result = await timed(stagesMs, 'load', () =>
        loadEmptyResult(admin, user!.id, claim.batch_id, claim.business_date));
      const completedDurationMs = Date.now() - startedAt;
      deferCompletedDuration(
        admin, claim.batch_id, Number(claim.attempt_count), completedDurationMs, requestId,
      );
      console.log(JSON.stringify({
        event: 'daily_matches_generated', requestId, batchId: claim.batch_id,
        outcome: finalized?.batch_status ?? 'empty', candidateCount, matchCount: 0,
        algorithmVersion, durationMs: Date.now() - startedAt, stagesMs,
      }));
      logOutcome(requestId, startedAt, 'empty', {
        businessDate: claim.business_date,
        batchId: claim.batch_id,
        source: 'generated',
        reason: result.reason,
        candidateCount,
        stagesMs,
      });
      return jsonResponse(result, 200, requestId);
    }
    const batch = await timed(stagesMs, 'load', () => loadReadyBatch(admin, user!.id, claim.batch_id));
    const completedDurationMs = Date.now() - startedAt;
    deferCompletedDuration(
      admin, claim.batch_id, Number(claim.attempt_count), completedDurationMs, requestId,
    );
    console.log(JSON.stringify({
      event: 'daily_matches_generated', requestId, batchId: claim.batch_id,
      outcome: finalized?.batch_status ?? 'ready', candidateCount, matchCount: batch.matches.length,
      algorithmVersion, durationMs: Date.now() - startedAt, stagesMs,
    }));
    logOutcome(requestId, startedAt, 'ready', {
      businessDate: claim.business_date,
      batchId: claim.batch_id,
      source: 'generated',
      candidateCount,
      matchCount: batch.matches.length,
      stagesMs,
    });
    return jsonResponse({ status: 'ready', businessDate: claim.business_date, batch, source: 'generated' }, 200, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    const errorCode = message.split(':')[0] || 'generation_failed';
    await failClaim(admin, claim.batch_id, claim.claim_token, errorCode, candidateCount, startedAt);
    console.error(JSON.stringify({
      event: 'daily_matches_generation_failed', requestId, batchId: claim.batch_id,
      errorCode, candidateCount, durationMs: Date.now() - startedAt, stagesMs,
    }));
    return errorResponse(requestId, 'matching_generation_failed', 'Không thể tạo gợi ý lúc này. Vui lòng thử lại.', 503, true, 2_000);
  }
});
