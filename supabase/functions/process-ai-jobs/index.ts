import {
  createServiceClient,
  errorResponse,
  jsonObjectBody,
  jsonResponse,
  requestIdFor,
} from '../_shared/client.ts';
import { buildVectorTexts, type RawAnswer } from '../_shared/analysis.ts';
import {
  createEmbeddings,
  DEFAULT_CHAT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIM,
  OpenAIRequestError,
  structuredResponse,
} from '../_shared/openai.ts';

const MAX_READ_COUNT = 5;
const MAX_EMBEDDING_INPUT_CHARS = 8_000;

interface QueueJob {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  message: Record<string, unknown>;
}

interface EnrichmentUpdate {
  matchId: string;
  candidateId: string;
  reason: string;
  opener: string;
}

interface FailureMark {
  recorded: boolean;
  stale: boolean;
  archiveSafe: boolean;
}

class PermanentJobError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

class RetryableJobError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'RetryableJobError';
  }
}

const ENRICHMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['matchId', 'reason', 'opener'],
        properties: {
          matchId: { type: 'string' },
          reason: { type: 'string' },
          opener: { type: 'string' },
        },
      },
    },
  },
};

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.slice(0, 30).map(item => text(item, 200)).filter(Boolean) : [];
}

function joinText(...parts: unknown[]): string {
  return parts.flatMap(part => Array.isArray(part) ? part.slice(0, 30) : [part])
    .map(part => text(part, 2_000))
    .filter(Boolean)
    .join('. ')
    .slice(0, MAX_EMBEDDING_INPUT_CHARS);
}

function candidatePromptSnapshot(value: unknown) {
  const candidate = object(value);
  return {
    name: text(candidate.name, 120),
    age: positiveInteger(candidate.age),
    major: text(candidate.major, 40),
    campus: text(candidate.campus, 40),
    bio: text(candidate.bio, 500),
    interests: stringList(candidate.interests).slice(0, 10),
    personalityTags: stringList(candidate.personality_tags ?? candidate.personalityTags).slice(0, 10),
    datingGoals: stringList(candidate.dating_goals ?? candidate.datingGoals).slice(0, 10),
    preferredVibes: stringList(candidate.preferred_vibes ?? candidate.preferredVibes).slice(0, 10),
  };
}

function positiveInteger(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

function checkedVector(values: number[]): number[] {
  if (values.length !== EMBEDDING_DIM || !values.every(Number.isFinite)) {
    throw new PermanentJobError('invalid_vector_dimensions', `Expected ${EMBEDDING_DIM} finite values.`);
  }
  return values;
}

async function secretMatches(req: Request): Promise<boolean> {
  const expected = Deno.env.get('AI_WORKER_SECRET');
  if (!expected) return false;
  const authorization = req.headers.get('authorization') ?? '';
  const provided = req.headers.get('x-worker-secret') ??
    (authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '');
  const encoder = new TextEncoder();
  const [expectedHash, providedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
  ]);
  const left = new Uint8Array(expectedHash);
  const right = new Uint8Array(providedHash);
  let difference = left.length ^ right.length;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ (right[i] ?? 0);
  return difference === 0;
}

async function processProfileEmbedding(admin: ReturnType<typeof createServiceClient>, message: Record<string, unknown>) {
  const userId = text(message.userId, 100);
  const profileRevision = positiveInteger(message.profileRevision);
  if (!userId || !profileRevision) throw new PermanentJobError('invalid_embedding_job', 'Missing userId/profileRevision.');

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,profile_revision,onboarding_answers,ai_profile_analysis,ai_signals,bio,interests,personality_tags,dating_goals,preferred_vibes,profile_text')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || Number(profile.profile_revision) !== profileRevision) return 'stale';

  const { data: claimed, error: claimError } = await admin.rpc('mark_profile_embedding_processing', {
    p_user_id: userId,
    p_profile_revision: profileRevision,
  });
  if (claimError) throw claimError;
  if (!claimed) return 'stale';

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new PermanentJobError('provider_not_configured', 'OPENAI_API_KEY is not configured.');
  const { data: rateRows, error: rateError } = await admin.rpc('claim_ai_rate_limit', {
    p_user_id: userId,
    p_scope: 'profile_embedding',
    p_limit: 5,
    p_window_seconds: 60,
  });
  const rate = Array.isArray(rateRows) ? rateRows[0] : rateRows;
  if (rateError || !rate?.allowed) {
    throw new RetryableJobError(
      rateError ? 'rate_limit_unavailable' : 'rate_limited',
      'Embedding provider call was not allowed.',
    );
  }
  const answers = Array.isArray(profile.onboarding_answers)
    ? profile.onboarding_answers as unknown as RawAnswer[]
    : [];
  const vectorTexts = buildVectorTexts(answers, profile.ai_profile_analysis);
  const legacySignals = object(object(object(profile.ai_signals).onboarding).extractedTraits);
  const profileText = object(profile.profile_text);
  const base = joinText(
    profile.bio,
    stringList(profile.interests),
    stringList(profile.personality_tags),
  ) || 'Hồ sơ thành viên F-Love đang được nâng cấp.';
  const ordered = [
    vectorTexts.self || base,
    vectorTexts.need || joinText(stringList(profile.dating_goals), legacySignals.intents) || base,
    vectorTexts.preference || joinText(stringList(profile.preferred_vibes), legacySignals.preferredPartnerTraits) || base,
    vectorTexts.communication || joinText(profileText.conversationStyle, Object.keys(object(legacySignals.communication))) || base,
    vectorTexts.lifestyle || joinText(stringList(profile.interests), Object.keys(object(legacySignals.lifestyle))) || base,
  ].map(value => text(value, MAX_EMBEDDING_INPUT_CHARS));
  if (ordered.some(value => !value.trim())) {
    throw new PermanentJobError('embedding_input_empty', 'One or more embedding inputs are empty.');
  }
  const embeddings = await createEmbeddings({
    apiKey,
    model: Deno.env.get('OPENAI_EMBEDDING_MODEL') ?? DEFAULT_EMBEDDING_MODEL,
    inputs: ordered,
    dimensions: EMBEDDING_DIM,
    deadlineMs: 20_000,
    maxAttempts: 2,
  });
  if (embeddings.some(value => value == null)) {
    throw new PermanentJobError('embedding_response_incomplete', 'Provider returned incomplete embeddings.');
  }

  const [self, need, preference, communication, lifestyle] = embeddings as number[][];
  const { data: completed, error: completeError } = await admin.rpc('complete_profile_embedding_job', {
    p_user_id: userId,
    p_profile_revision: profileRevision,
    p_vectors: {
      self: checkedVector(self),
      need: checkedVector(need),
      preference: checkedVector(preference),
      communication: checkedVector(communication),
      lifestyle: checkedVector(lifestyle),
    },
    p_error_code: null,
  });
  if (completeError) throw completeError;
  return completed ? 'ready' : 'stale';
}

async function processMatchEnrichment(admin: ReturnType<typeof createServiceClient>, message: Record<string, unknown>) {
  const batchId = text(message.batchId, 200);
  const attemptCount = positiveInteger(message.attemptCount);
  if (!batchId || !attemptCount) {
    throw new PermanentJobError('invalid_enrichment_job', 'Missing batchId/attemptCount.');
  }

  const { data: batch, error: batchError } = await admin
    .from('daily_match_batches')
    .select('id,user_id,status,enrichment_status,attempt_count,updated_at')
    .eq('id', batchId)
    .maybeSingle();
  if (batchError) throw batchError;
  if (!batch || batch.status !== 'ready') return 'stale';
  if (Number(batch.attempt_count) !== attemptCount) return 'stale';
  if (batch.enrichment_status === 'ready' || batch.enrichment_status === 'skipped') {
    return batch.enrichment_status;
  }
  if (batch.enrichment_status === 'processing') {
    const processingAge = Date.now() - new Date(batch.updated_at).getTime();
    if (Number.isFinite(processingAge) && processingAge < 45_000) return 'processing';
  }

  const { data: matches, error: matchesError } = await admin
    .from('curated_matches')
    .select('id,candidate_id,candidate_snapshot,ai_reason,compatibility_label,compatibility_score')
    .eq('batch_id', batchId)
    .order('compatibility_score', { ascending: false });
  if (matchesError) throw matchesError;
  if (!matches?.length) {
    const { data: skipped, error: skipError } = await admin.from('daily_match_batches')
      .update({ enrichment_status: 'skipped', enrichment_error_code: 'no_matches' })
      .eq('id', batchId)
      .eq('attempt_count', attemptCount)
      .eq('enrichment_status', batch.enrichment_status)
      .eq('updated_at', batch.updated_at)
      .select('id')
      .maybeSingle();
    if (skipError) throw skipError;
    return skipped ? 'skipped' : 'stale';
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    const { data: skipped, error: skipError } = await admin.from('daily_match_batches').update({
        enrichment_status: 'skipped',
        enrichment_error_code: 'provider_not_configured',
      }).eq('id', batchId)
      .eq('attempt_count', attemptCount)
      .eq('enrichment_status', batch.enrichment_status)
      .eq('updated_at', batch.updated_at)
      .select('id')
      .maybeSingle();
    if (skipError) throw skipError;
    return skipped ? 'skipped' : 'stale';
  }

  // Compare-and-swap the exact attempt/status before spending provider quota. A
  // second worker, or a worker for a regenerated attempt, exits without an AI call.
  const { data: processingBatch, error: processingError } = await admin
    .from('daily_match_batches')
    .update({ enrichment_status: 'processing', enrichment_error_code: null })
    .eq('id', batchId)
    .eq('attempt_count', attemptCount)
    .eq('status', 'ready')
    .eq('enrichment_status', batch.enrichment_status)
    // A status-only processing→processing reclaim is not a CAS: two stale
    // readers would both succeed and both spend provider quota. updated_at is
    // advanced by the batch trigger, so only one reader can claim this version.
    .eq('updated_at', batch.updated_at)
    .select('id')
    .maybeSingle();
  if (processingError) throw processingError;
  if (!processingBatch) return 'stale';

  const { data: rateRows, error: rateError } = await admin.rpc('claim_ai_rate_limit', {
    p_user_id: batch.user_id,
    p_scope: 'match_enrichment',
    p_limit: 30,
    p_window_seconds: 3_600,
  });
  const rate = Array.isArray(rateRows) ? rateRows[0] : rateRows;
  if (rateError || !rate?.allowed) {
    throw new RetryableJobError(
      rateError ? 'rate_limit_unavailable' : 'rate_limited',
      'Match-enrichment provider call was not allowed yet.',
    );
  }

  const output = await structuredResponse({
    apiKey,
    model: Deno.env.get('OPENAI_MODEL') ?? DEFAULT_CHAT_MODEL,
    system: [
      'Bạn viết lời giải thích ngắn và câu mở đầu bằng tiếng Việt cho các gợi ý F-Love đã được xếp hạng.',
      'Không thay đổi điểm, thứ tự hoặc matchId. Không suy đoán thuộc tính nhạy cảm.',
      'Reason tối đa 240 ký tự, opener tối đa 180 ký tự, tự nhiên và tôn trọng.',
    ].join(' '),
    user: matches.map(match => ({
      matchId: match.id,
      candidate: candidatePromptSnapshot(match.candidate_snapshot),
      deterministicReason: text(match.ai_reason, 500),
      label: text(match.compatibility_label, 120),
      score: match.compatibility_score,
    })),
    schemaName: 'match_enrichment',
    schema: ENRICHMENT_SCHEMA,
    deadlineMs: 20_000,
    maxAttempts: 2,
    maxOutputTokens: 1_500,
  });
  const allowedIds = new Set(matches.map(match => match.id));
  const candidateByMatch = new Map(matches.map(match => [match.id, match.candidate_id]));
  const items: unknown[] = Array.isArray(output?.items) ? output.items : [];
  const normalized: EnrichmentUpdate[] = items.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    const matchId = text(value.matchId, 200);
    const reason = text(value.reason, 240);
    const opener = text(value.opener, 180);
    const candidateId = text(candidateByMatch.get(matchId), 100);
    return allowedIds.has(matchId) && candidateId && reason && opener
      ? [{ matchId, candidateId, reason, opener }]
      : [];
  });
  if (normalized.length !== matches.length || new Set(normalized.map(item => item.matchId)).size !== matches.length) {
    throw new PermanentJobError('invalid_enrichment_response', 'Provider omitted or duplicated a match.');
  }

  const { data: finalizeStatus, error: finalizeError } = await admin.rpc('complete_daily_match_enrichment', {
    p_batch_id: batchId,
    p_attempt_count: attemptCount,
    p_updates: normalized.map(item => ({
      candidate_id: item.candidateId,
      ai_reason: item.reason,
      suggested_opener: item.opener,
    })),
    p_error_code: null,
  });
  if (finalizeError) throw finalizeError;
  return finalizeStatus === 'ready' ? 'ready' : 'stale';
}

async function markJobFailure(
  admin: ReturnType<typeof createServiceClient>,
  message: Record<string, unknown>,
  code: string,
): Promise<FailureMark> {
  const type = text(message.type, 80);
  if (type === 'profile_embedding') {
    const userId = text(message.userId, 100);
    const profileRevision = positiveInteger(message.profileRevision);
    if (userId && profileRevision) {
      const { data, error } = await admin.rpc('complete_profile_embedding_job', {
        p_user_id: userId,
        p_profile_revision: profileRevision,
        p_vectors: {},
        p_error_code: code,
      });
      return {
        recorded: !error && data === true,
        stale: !error && data === false,
        archiveSafe: !error,
      };
    }
  } else if (type === 'match_enrichment') {
    const batchId = text(message.batchId, 200);
    const attemptCount = positiveInteger(message.attemptCount);
    if (batchId && attemptCount) {
      const { data, error } = await admin.rpc('complete_daily_match_enrichment', {
        p_batch_id: batchId,
        p_attempt_count: attemptCount,
        p_updates: [],
        p_error_code: code,
      });
      return {
        recorded: !error && data === 'failed',
        stale: !error && data === 'skipped',
        archiveSafe: !error,
      };
    }
  }
  return {
    recorded: type !== 'profile_embedding' && type !== 'match_enrichment',
    stale: false,
    // A malformed/unknown message has no identifiable domain row to strand.
    archiveSafe: true,
  };
}

Deno.serve(async req => {
  const startedAt = Date.now();
  const requestId = requestIdFor(req);
  if (req.method !== 'POST') {
    return errorResponse(requestId, 'method_not_allowed', 'Only POST is supported.', 405);
  }
  if (!(await secretMatches(req))) {
    return errorResponse(requestId, 'not_authorized', 'Invalid worker secret.', 401);
  }

  const body = await jsonObjectBody(req);
  const batchSize = Math.max(1, Math.min(10, Number(body.batchSize) || 5));
  const admin = createServiceClient();
  const { data, error } = await admin.rpc('read_ai_jobs', {
    p_batch_size: batchSize,
    p_visibility_timeout: 60,
  });
  if (error) {
    console.error(JSON.stringify({ event: 'ai_worker_read_failed', requestId, code: error.code }));
    return errorResponse(requestId, 'queue_read_failed', 'Could not read AI jobs.', 503, true, 5_000);
  }

  const jobs = (Array.isArray(data) ? data : []) as unknown as QueueJob[];
  const outcomes = await Promise.all(jobs.map(async job => {
    const message = job.message && typeof job.message === 'object' ? job.message : {};
    const type = text(message.type, 80);
    const readCount = Math.max(0, Number(job.read_ct) || 0);
    const enqueuedAtMs = Date.parse(job.enqueued_at);
    const queueAgeMs = Number.isFinite(enqueuedAtMs) ? Math.max(0, Date.now() - enqueuedAtMs) : 0;
    const result = (details: Record<string, unknown>) => ({
      msgId: job.msg_id,
      type,
      readCount,
      queueAgeMs,
      ...details,
    });
    let outcome: string;
    try {
      outcome = type === 'profile_embedding'
        ? await processProfileEmbedding(admin, message)
        : type === 'match_enrichment'
          ? await processMatchEnrichment(admin, message)
          : (() => { throw new PermanentJobError('unknown_job_type', `Unknown job type: ${type}`); })();
    } catch (caught) {
      const code = caught instanceof PermanentJobError
        ? caught.code
        : caught instanceof RetryableJobError
          ? caught.code
        : caught instanceof Error ? caught.name : 'unknown_error';
      const terminal = caught instanceof PermanentJobError
        || (caught instanceof OpenAIRequestError && !caught.retryable)
        || Number(job.read_ct) >= MAX_READ_COUNT;
      const mark = await markJobFailure(admin, message, code);
      if (mark.stale) {
        const { data: deleted, error: deleteError } = await admin.rpc('delete_ai_job', { p_msg_id: job.msg_id });
        if (deleteError || !deleted) {
          return result({ outcome: 'stale_ack_retrying', errorCode: code });
        }
        return result({ outcome: 'stale', errorCode: code });
      }
      if (!mark.archiveSafe) {
        console.error(JSON.stringify({
          event: 'ai_job_failure_mark_failed', requestId, msgId: job.msg_id, type, code,
        }));
        return result({ outcome: 'failure_mark_retrying', errorCode: code });
      }
      if (terminal) {
        const { data: archived, error: archiveError } = await admin.rpc('archive_ai_job', { p_msg_id: job.msg_id });
        if (archiveError || !archived) {
          console.error(JSON.stringify({ event: 'ai_job_archive_failed', requestId, msgId: job.msg_id, type }));
          return result({ outcome: 'archive_retrying', errorCode: code, marked: mark.recorded });
        }
      }
      console.error(JSON.stringify({ event: 'ai_job_failed', requestId, msgId: job.msg_id, type, code, terminal, marked: mark.recorded }));
      return result({ outcome: terminal ? 'archived' : 'retrying', errorCode: code, marked: mark.recorded });
    }

    // Ack is deliberately outside the processing try/catch: a queue transport
    // failure must never downgrade already-completed domain state.
    const { data: deleted, error: deleteError } = await admin.rpc('delete_ai_job', { p_msg_id: job.msg_id });
    if (deleteError || !deleted) {
      console.error(JSON.stringify({ event: 'ai_job_ack_failed', requestId, msgId: job.msg_id, type }));
      return result({ outcome: 'ack_retrying' });
    }
    return result({ outcome });
  }));

  console.log(JSON.stringify({
    event: 'ai_worker_completed',
    requestId,
    jobs: jobs.length,
    durationMs: Date.now() - startedAt,
    maxQueueAgeMs: Math.max(0, ...outcomes.map(item => Number(item.queueAgeMs) || 0)),
    maxReadCount: Math.max(0, ...outcomes.map(item => Number(item.readCount) || 0)),
    outcomes,
  }));
  return jsonResponse({ ok: true, processed: jobs.length, outcomes }, 200, requestId);
});
