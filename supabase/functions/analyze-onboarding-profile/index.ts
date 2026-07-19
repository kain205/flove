import { createServiceClient, errorResponse, expectedUserFenceResponse, jsonObjectBody, jsonResponse, requestIdFor, requireUser } from '../_shared/client.ts';
import { DEFAULT_CHAT_MODEL, structuredResponse } from '../_shared/openai.ts';
import { ensureLegacyDraft, LegacyOnboardingError } from '../_shared/onboarding-compat.ts';
import {
  ANALYSIS_SCHEMA,
  ANALYSIS_SYSTEM_PROMPT,
  canonicalizeAnalysis,
  fallbackAnalysis,
  normalizeAnalysis,
  onboardingDraftFromJson,
  validateOnboardingDraft,
} from '../_shared/analysis.ts';

// Wall-clock budget for the whole request. The provider call for the full strict-schema
// analysis typically needs ~7s and openAIFetch splits its budget across maxAttempts, so
// each attempt must still get comfortably more than that after auth/draft/rate-limit I/O.
const ANALYZE_DEADLINE_MS = 25_000;
const FALLBACK_PERSIST_BUDGET_MS = 1_500;

function positiveRevision(value: unknown): number | null {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null;
}

async function handleAnalyze(req: Request, requestId: string): Promise<Response> {
  const startedAt = Date.now();
  const { client, user, response } = await requireUser(req, requestId);
  if (response) return response;

  const body = await jsonObjectBody(req);
  let requestedRevision = positiveRevision(body.draftRevision);
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId, body.draftRevision != null);
  if (fenceResponse) return fenceResponse;
  if (body.draftRevision != null && !requestedRevision) {
    return errorResponse(requestId, 'invalid_request', 'draftRevision không hợp lệ.', 400);
  }
  const admin = createServiceClient();
  let row: any;
  if (!requestedRevision) {
    try {
      row = await ensureLegacyDraft({ body, userId: user!.id, userClient: client, admin });
      requestedRevision = positiveRevision(row.draft_revision);
    } catch (error) {
      if (error instanceof LegacyOnboardingError) {
        return errorResponse(requestId, error.code, error.message, error.status, error.retryable);
      }
      return errorResponse(requestId, 'draft_save_failed', 'Không lưu được bản nháp onboarding.', 503, true);
    }
  } else {
    const { data, error: draftError } = await admin
      .from('onboarding_drafts')
      .select('draft,draft_revision,analysis,analysis_revision,analysis_source')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (draftError) {
      console.error(JSON.stringify({ event: 'onboarding_analysis_draft_error', requestId, code: draftError.code }));
      return errorResponse(requestId, 'draft_unavailable', 'Không tải được bản nháp onboarding.', 503, true);
    }
    row = data;
  }
  if (!requestedRevision) return errorResponse(requestId, 'invalid_request', 'draftRevision hoặc raw answers/basic là bắt buộc.', 400);
  if (!row) return errorResponse(requestId, 'draft_not_found', 'Chưa có bản nháp onboarding.', 404);
  if (Number(row.draft_revision) !== requestedRevision) {
    return errorResponse(requestId, 'stale_draft', 'Bản nháp đã thay đổi. Vui lòng phân tích lại.', 409);
  }
  if (row.analysis && Number(row.analysis_revision) === requestedRevision) {
    return jsonResponse({
      ok: true,
      analysis: row.analysis,
      generatedBy: row.analysis_source ?? 'cached',
      draftRevision: requestedRevision,
      analysisRevision: requestedRevision,
    }, 200, requestId);
  }

  const draft = onboardingDraftFromJson(row.draft);
  if (!draft) return errorResponse(requestId, 'invalid_draft', 'Bản nháp onboarding không hợp lệ.', 422);
  const validationError = validateOnboardingDraft(draft);
  if (validationError) return errorResponse(requestId, 'incomplete_draft', validationError, 422);

  let generatedBy = 'fallback';
  let analysis = fallbackAnalysis(draft.answers, draft.basic);
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  let providerAllowed = Boolean(apiKey);
  if (apiKey) {
    const { data: rateRows, error: rateError } = await admin.rpc('claim_ai_rate_limit', {
      p_user_id: user!.id,
      p_scope: 'onboarding_analysis',
      p_limit: 6,
      p_window_seconds: 600,
    });
    const rate = Array.isArray(rateRows) ? rateRows[0] : rateRows;
    providerAllowed = !rateError && Boolean(rate?.allowed);
    if (!providerAllowed) {
      generatedBy = rateError ? 'fallback-rate-limit-unavailable' : 'fallback-rate-limited';
      console.warn(JSON.stringify({
        event: 'onboarding_analysis_provider_skipped',
        requestId,
        reason: rateError ? 'rate_limit_unavailable' : 'rate_limited',
      }));
    }
  }
  if (apiKey && providerAllowed) {
    // Keep enough of the request-wide budget to canonicalize and durably save
    // the deterministic fallback if the provider consumes its full allowance.
    const remainingMs = ANALYZE_DEADLINE_MS - (Date.now() - startedAt) - FALLBACK_PERSIST_BUDGET_MS;
    if (remainingMs < 500) {
      generatedBy = 'fallback-deadline-exhausted';
    } else {
      try {
        const model = Deno.env.get('OPENAI_MODEL') ?? DEFAULT_CHAT_MODEL;
        const raw = await structuredResponse({
          apiKey,
          model,
          system: ANALYSIS_SYSTEM_PROMPT,
          user: { answers: draft.answers, basic: draft.basic },
          schemaName: 'profile_analysis',
          schema: ANALYSIS_SCHEMA,
          deadlineMs: remainingMs,
          maxAttempts: 2,
          maxOutputTokens: 3_000,
        });
        analysis = normalizeAnalysis(raw);
        generatedBy = `openai-${model}`;
      } catch (error) {
        console.error(JSON.stringify({
          event: 'onboarding_analysis_provider_fallback',
          requestId,
          durationMs: Date.now() - startedAt,
          errorCode: error instanceof Error ? error.name : 'unknown',
        }));
      }
    }
  }
  analysis = canonicalizeAnalysis(analysis, draft.answers, draft.basic);

  const { data: savedValue, error: saveError } = await admin.rpc('save_onboarding_analysis', {
    p_user_id: user!.id,
    p_draft_revision: requestedRevision,
    p_analysis: analysis,
    p_analysis_source: generatedBy,
  });
  if (saveError) {
    const stale = saveError.message.toLowerCase().includes('revision');
    console.error(JSON.stringify({ event: 'onboarding_analysis_save_error', requestId, code: saveError.code }));
    return errorResponse(
      requestId,
      stale ? 'stale_draft' : 'analysis_save_failed',
      stale ? 'Bản nháp đã thay đổi. Vui lòng phân tích lại.' : 'Không lưu được kết quả phân tích.',
      stale ? 409 : 503,
      !stale,
    );
  }
  const saved = Array.isArray(savedValue) ? savedValue[0] : savedValue;
  const analysisRevision = positiveRevision(saved?.analysis_revision) ?? requestedRevision;

  console.log(JSON.stringify({
    event: 'onboarding_analysis_completed',
    requestId,
    userId: user!.id,
    draftRevision: requestedRevision,
    generatedBy,
    durationMs: Date.now() - startedAt,
  }));
  return jsonResponse({
    ok: true,
    analysis: saved?.analysis ?? analysis,
    generatedBy,
    draftRevision: requestedRevision,
    analysisRevision,
  }, 200, requestId);
}

Deno.serve(req => {
  const requestId = requestIdFor(req);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const task = handleAnalyze(req, requestId).catch(error => {
    console.error(JSON.stringify({
      event: 'onboarding_analysis_unhandled_error',
      requestId,
      errorCode: error instanceof Error ? error.name : 'unknown',
    }));
    return errorResponse(requestId, 'analysis_failed', 'Chưa phân tích được hồ sơ.', 503, true, 2_000);
  });
  const deadline = new Promise<Response>(resolve => {
    timeout = setTimeout(() => resolve(errorResponse(
      requestId,
      'analysis_deadline_exceeded',
      'Phân tích mất quá nhiều thời gian. Vui lòng thử lại.',
      503,
      true,
      2_000,
    )), ANALYZE_DEADLINE_MS - 100);
  });
  return Promise.race([task, deadline]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
});
