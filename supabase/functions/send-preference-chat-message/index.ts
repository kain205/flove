import {
  createServiceClient,
  errorResponse,
  expectedUserFenceResponse,
  jsonObjectBody,
  jsonResponse,
  requestIdFor,
  requireUser,
  rpcErrorResponse,
} from '../_shared/client.ts';
import { DEFAULT_CHAT_MODEL, structuredResponse } from '../_shared/openai.ts';
import {
  deterministicPreferencePayload,
  normalizePreferenceCoachPayload,
  PREFERENCE_COACH_SCHEMA,
  PREFERENCE_COACH_SYSTEM_PROMPT,
  preferenceCoachAbandonParams,
  preferenceCoachContextFromRow,
  preferenceCoachPromptInput,
  preferenceCoachRequestFingerprint,
  type PreferenceCoachContext,
  type PreferenceCoachPayload,
  unchangedMemoryFallback,
} from './coach.ts';

const MAX_CONTENT_LENGTH = 2_000;
const COACH_PROVIDER_DEADLINE_MS = 10_000;

function firstRow(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? row as Record<string, unknown> : {};
}

function responsePayload(value: unknown): PreferenceCoachPayload {
  if (typeof value === 'string') {
    try {
      return normalizePreferenceCoachPayload(JSON.parse(value));
    } catch {
      throw new Error('Cached Preference Coach response is invalid.');
    }
  }
  return normalizePreferenceCoachPayload(value);
}

async function handlePreferenceCoach(req: Request, requestId: string): Promise<Response> {
  const startedAt = Date.now();
  const { client, user, response } = await requireUser(req, requestId);
  if (response) return response;

  const body = await jsonObjectBody(req);
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId, true);
  if (fenceResponse) return fenceResponse;
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content || content.length > MAX_CONTENT_LENGTH) {
    return errorResponse(requestId, 'invalid_content', 'Nội dung phải có từ 1–2.000 ký tự.', 400);
  }

  const headerKey = req.headers.get('idempotency-key')?.trim() ?? '';
  const bodyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  if (headerKey && bodyKey && headerKey !== bodyKey) {
    return errorResponse(requestId, 'invalid_idempotency_key', 'Idempotency key không khớp.', 400);
  }
  const clientRequestId = headerKey || bodyKey;
  if (!clientRequestId || clientRequestId.length > 200) {
    return errorResponse(requestId, 'invalid_idempotency_key', 'Idempotency key là bắt buộc và tối đa 200 ký tự.', 400);
  }

  const admin = createServiceClient();
  const fingerprint = await preferenceCoachRequestFingerprint(content);
  const { data: claimValue, error: claimError } = await admin.rpc(
    'claim_ai_assistant_request' as never,
    {
      p_scope: 'preference_chat',
      p_client_request_id: clientRequestId,
      p_request_fingerprint: fingerprint,
      p_expected_user_id: user!.id,
    } as never,
  );
  if (claimError) {
    return rpcErrorResponse(requestId, claimError, 'coach_claim_failed', 'Chưa bắt đầu được lượt trò chuyện.');
  }
  const claim = firstRow(claimValue);
  const claimStatus = typeof claim.request_status === 'string' ? claim.request_status : '';
  if (claimStatus === 'cached') {
    try {
      const payload = responsePayload(claim.response_payload);
      return jsonResponse({ ok: true, applied: false, ...payload }, 200, requestId);
    } catch {
      return errorResponse(requestId, 'invalid_cached_response', 'Kết quả đã lưu không hợp lệ.', 503, true, 1_000);
    }
  }
  if (claimStatus === 'in_progress') {
    return errorResponse(
      requestId,
      'coach_in_progress',
      'F-Love AI Coach đang xử lý lời nhắn này. Vui lòng thử lại sau giây lát.',
      409,
      true,
      1_000,
    );
  }
  const claimToken = typeof claim.claim_token === 'string' ? claim.claim_token : '';
  const providerAlreadyStarted = claimStatus === 'provider_started';
  if ((claimStatus !== 'claimed' && !providerAlreadyStarted) || !claimToken) {
    return errorResponse(requestId, 'invalid_claim', 'Trạng thái xử lý không hợp lệ.', 503, true, 1_000);
  }

  let context: PreferenceCoachContext | null = null;
  const { data: contextValue, error: contextError } = await client.rpc(
    'get_preference_coach_context' as never,
    { p_expected_user_id: user!.id, p_limit: 12 } as never,
  );
  if (!contextError) context = preferenceCoachContextFromRow(contextValue);

  let payload = unchangedMemoryFallback(context);
  let updateMemory = false;
  let providerFenced = providerAlreadyStarted;
  let source = providerAlreadyStarted
    ? 'fallback-provider-already-started'
    : contextError ? 'fallback-context-unavailable' : 'fallback-provider-unavailable';

  if (providerAlreadyStarted) {
    // A prior worker crossed the durable provider boundary but did not finish
    // the atomic save. Retry finalizes a fallback without calling OpenAI again.
  } else if (context && !context.llmEligible) {
    payload = deterministicPreferencePayload(context, content);
    updateMemory = true;
    source = 'deterministic-age-gate';
  } else if (context) {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (apiKey) {
      let providerAllowed = false;
      try {
        const { data: rateValue, error: rateError } = await admin.rpc('claim_ai_rate_limit', {
          p_user_id: user!.id,
          p_scope: 'preference_chat',
          p_limit: 20,
          p_window_seconds: 600,
        });
        const rate = firstRow(rateValue);
        providerAllowed = !rateError && rate.allowed === true;
        if (rateError) source = 'fallback-rate-limit-unavailable';
        else if (!providerAllowed) source = 'fallback-rate-limited';
      } catch {
        source = 'fallback-rate-limit-unavailable';
      }
      if (providerAllowed) {
        const { data: startedValue, error: startedError } = await admin.rpc(
          'mark_ai_assistant_provider_started' as never,
          {
            p_scope: 'preference_chat',
            p_client_request_id: clientRequestId,
            p_request_fingerprint: fingerprint,
            p_claim_token: claimToken,
            p_expected_user_id: user!.id,
          } as never,
        );
        if (startedError) {
          source = 'fallback-provider-fence-unavailable';
        } else {
          // Once the marker transaction commits, no retry may call the provider
          // for this request even if this worker crashes before finalization.
          providerFenced = true;
          if (startedValue === true) {
            try {
              const model = Deno.env.get('OPENAI_MODEL') ?? DEFAULT_CHAT_MODEL;
              const raw = await structuredResponse({
                apiKey,
                model,
                system: PREFERENCE_COACH_SYSTEM_PROMPT,
                user: preferenceCoachPromptInput(context, content),
                schemaName: 'preference_coach_response',
                schema: PREFERENCE_COACH_SCHEMA,
                deadlineMs: COACH_PROVIDER_DEADLINE_MS,
                maxAttempts: 1,
                maxOutputTokens: 1_500,
              });
              payload = normalizePreferenceCoachPayload(raw);
              updateMemory = true;
              source = `openai-${model}`;
            } catch (error) {
              source = error instanceof Error && error.name === 'OpenAIRefusalError'
                ? 'fallback-provider-refusal'
                : 'fallback-provider-error';
              console.warn(JSON.stringify({
                event: 'preference_coach_provider_fallback',
                requestId,
                userId: user!.id,
                errorCode: error instanceof Error ? error.name : 'unknown',
              }));
            }
          } else {
            source = 'fallback-provider-fence-already-set';
          }
        }
      }
    }
  }

  const { data: finalValue, error: finalError } = await admin.rpc(
    'finalize_preference_coach_request' as never,
    {
      p_client_request_id: clientRequestId,
      p_request_fingerprint: fingerprint,
      p_claim_token: claimToken,
      p_content: content,
      p_response_payload: payload,
      p_update_memory: updateMemory,
      p_expected_user_id: user!.id,
    } as never,
  );
  if (finalError) {
    // An unstarted request may be released and retried safely. Once the durable
    // provider marker exists, retaining the claim is what enforces at-most-once.
    if (!providerFenced) try {
      const { error: abandonError } = await admin.rpc(
        'abandon_ai_assistant_request' as never,
        preferenceCoachAbandonParams({
          clientRequestId,
          fingerprint,
          claimToken,
          expectedUserId: user!.id,
        }) as never,
      );
      if (abandonError) {
        console.warn(JSON.stringify({
          event: 'preference_coach_abandon_failed',
          requestId,
          userId: user!.id,
          code: abandonError.code,
        }));
      }
    } catch (error) {
      console.warn(JSON.stringify({
        event: 'preference_coach_abandon_failed',
        requestId,
        userId: user!.id,
        errorCode: error instanceof Error ? error.name : 'unknown',
      }));
    }
    return rpcErrorResponse(requestId, finalError, 'coach_save_failed', 'Chưa lưu được lượt trò chuyện.');
  }
  const finalized = firstRow(finalValue);
  let savedPayload = payload;
  try {
    savedPayload = responsePayload(finalized.response_payload ?? payload);
  } catch {
    return errorResponse(requestId, 'invalid_saved_response', 'Kết quả đã lưu không hợp lệ.', 503, true, 1_000);
  }

  console.log(JSON.stringify({
    event: 'preference_coach_completed',
    requestId,
    userId: user!.id,
    requestStatus: finalized.request_status ?? 'completed',
    source,
    memoryUpdated: updateMemory,
    durationMs: Date.now() - startedAt,
  }));
  return jsonResponse({
    ok: true,
    applied: finalized.request_status !== 'cached',
    llmEligible: context?.llmEligible ?? false,
    ...savedPayload,
  }, 200, requestId);
}

Deno.serve(req => {
  const requestId = requestIdFor(req);
  return handlePreferenceCoach(req, requestId).catch(error => {
    console.error(JSON.stringify({
      event: 'preference_coach_unhandled_error',
      requestId,
      errorCode: error instanceof Error ? error.name : 'unknown',
    }));
    return errorResponse(requestId, 'preference_coach_failed', 'F-Love AI Coach đang tạm gián đoạn.', 503, true, 2_000);
  });
});
