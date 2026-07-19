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
import { DEFAULT_CHAT_MODEL, OpenAIRequestError, structuredResponse } from '../_shared/openai.ts';
import {
  buildWingmanTranscript,
  MAX_DRAFT_CHARACTERS,
  normalizeDraft,
  parseWingmanSuggestions,
  requestFingerprint,
  safeSelfContext,
  WINGMAN_FALLBACK_SUGGESTIONS,
  WINGMAN_RESPONSE_SCHEMA,
  WINGMAN_SYSTEM_PROMPT,
  wingmanEligibility,
} from './wingman.ts';

const RATE_LIMIT = 12;
const RATE_WINDOW_SECONDS = 600;
const PROVIDER_DEADLINE_MS = 10_000;

async function abandonClaim(
  client: any,
  input: {
    clientRequestId: string;
    fingerprint: string;
    claimToken: string;
    expectedUserId: string;
  },
  requestId: string,
): Promise<void> {
  try {
    const { error } = await client.rpc(
      'abandon_ai_assistant_request' as never,
      {
        p_scope: 'conversation_wingman',
        p_client_request_id: input.clientRequestId,
        p_request_fingerprint: input.fingerprint,
        p_claim_token: input.claimToken,
        p_expected_user_id: input.expectedUserId,
      } as never,
    );
    if (error) {
      console.warn(JSON.stringify({ event: 'wingman_abandon_failed', requestId, code: error.code }));
    }
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'wingman_abandon_failed',
      requestId,
      errorCode: error instanceof Error ? error.name : 'unknown',
    }));
  }
}

function rowFrom(value: unknown): Record<string, any> | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' && !Array.isArray(row)
    ? row as Record<string, any>
    : null;
}

function cachedResponse(value: unknown, requestId: string): Response | null {
  try {
    const suggestions = parseWingmanSuggestions(value);
    return jsonResponse({ ok: true, suggestions, cached: true }, 200, requestId);
  } catch {
    return null;
  }
}

function eligibilityResponse(context: Record<string, any>, requestId: string): Response | null {
  const eligibility = wingmanEligibility(context);
  if (eligibility === 'eligible') return null;
  if (eligibility === 'under_18') {
    return errorResponse(
      requestId,
      'wingman_age_restricted',
      'Wingman hiện chỉ dành cho thành viên từ 18 tuổi.',
      403,
    );
  }
  if (eligibility === 'anonymous_not_revealed') {
    return errorResponse(
      requestId,
      'wingman_requires_reveal',
      'Wingman chỉ khả dụng sau khi cả hai đã đồng ý tiết lộ trong Blind Date.',
      403,
    );
  }
  return errorResponse(requestId, 'wingman_unavailable', 'Wingman chưa khả dụng cho cuộc trò chuyện này.', 403);
}

async function handleWingman(req: Request, requestId: string): Promise<Response> {
  const { client, user, response } = await requireUser(req, requestId);
  if (response) return response;

  const body = await jsonObjectBody(req);
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId, true);
  if (fenceResponse) return fenceResponse;
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  if (!conversationId || conversationId.length > 200) {
    return errorResponse(requestId, 'invalid_conversation', 'conversationId không hợp lệ.', 400);
  }
  const rawDraft = typeof body.draft === 'string' ? body.draft : '';
  if (rawDraft.length > MAX_DRAFT_CHARACTERS) {
    return errorResponse(
      requestId,
      'draft_too_long',
      `Nội dung đang soạn không được vượt quá ${MAX_DRAFT_CHARACTERS} ký tự khi dùng Wingman.`,
      400,
    );
  }
  const draft = normalizeDraft(rawDraft);
  const headerKey = req.headers.get('idempotency-key')?.trim() ?? '';
  const bodyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  if (headerKey && bodyKey && headerKey !== bodyKey) {
    return errorResponse(requestId, 'invalid_idempotency_key', 'Idempotency key không khớp.', 400);
  }
  const suppliedKey = headerKey || bodyKey;
  const clientRequestId = typeof suppliedKey === 'string' ? suppliedKey.trim() : '';
  if (!clientRequestId || clientRequestId.length > 200) {
    return errorResponse(requestId, 'invalid_idempotency_key', 'Idempotency key không hợp lệ.', 400);
  }

  // This authenticated RPC is the privacy boundary: it checks participation and
  // returns only caller-relative message ownership plus the caller's own context.
  const { data: contextValue, error: contextError } = await client.rpc(
    'get_conversation_wingman_context' as never,
    {
      p_conversation_id: conversationId,
      p_expected_user_id: user!.id,
      p_limit: 20,
    } as never,
  );
  if (contextError) {
    console.warn(JSON.stringify({ event: 'wingman_context_denied', requestId, code: contextError.code }));
    return rpcErrorResponse(
      requestId,
      contextError,
      'wingman_context_unavailable',
      'Chưa tải được ngữ cảnh Wingman.',
    );
  }
  const context = rowFrom(contextValue);
  if (!context) return errorResponse(requestId, 'conversation_not_found', 'Không tìm thấy cuộc trò chuyện.', 404);
  const denied = eligibilityResponse(context, requestId);
  if (denied) return denied;

  const transcript = buildWingmanTranscript(context.messages);
  if (transcript.length === 0 && !draft) {
    return errorResponse(
      requestId,
      'wingman_context_empty',
      'Hãy bắt đầu cuộc trò chuyện hoặc nhập một bản nháp trước khi hỏi Wingman.',
      422,
    );
  }

  const providerPayload = {
    ownContext: safeSelfContext(context.self_context),
    transcript,
    ...(draft ? { currentDraft: draft } : {}),
  };
  const fingerprint = await requestFingerprint({
    conversationId,
    rawDraft,
  });
  const admin = createServiceClient();
  const { data: claimValue, error: claimError } = await admin.rpc(
    'claim_ai_assistant_request' as never,
    {
      p_scope: 'conversation_wingman',
      p_client_request_id: clientRequestId,
      p_request_fingerprint: fingerprint,
      p_expected_user_id: user!.id,
    } as never,
  );
  if (claimError) {
    console.warn(JSON.stringify({ event: 'wingman_claim_failed', requestId, code: claimError.code }));
    return rpcErrorResponse(requestId, claimError, 'wingman_claim_failed', 'Chưa bắt đầu được Wingman.');
  }
  const claim = rowFrom(claimValue);
  if (!claim) return errorResponse(requestId, 'wingman_claim_invalid', 'Wingman chưa sẵn sàng.', 503, true, 2_000);
  if (claim.request_status === 'cached') {
    const cached = cachedResponse(claim.response_payload, requestId);
    return cached ?? errorResponse(requestId, 'wingman_cache_invalid', 'Kết quả Wingman đã lưu không hợp lệ.', 503, true);
  }
  if (claim.request_status === 'in_progress') {
    return errorResponse(
      requestId,
      'wingman_in_progress',
      'Wingman đang chuẩn bị gợi ý. Vui lòng thử lại sau ít phút.',
      409,
      true,
      2_000,
    );
  }
  const claimToken = typeof claim.claim_token === 'string' ? claim.claim_token : '';
  const providerAlreadyStarted = claim.request_status === 'provider_started';
  if ((claim.request_status !== 'claimed' && !providerAlreadyStarted) || !claimToken) {
    return errorResponse(requestId, 'wingman_claim_invalid', 'Wingman chưa sẵn sàng.', 503, true, 2_000);
  }

  let suggestions: [string, string, string] = WINGMAN_FALLBACK_SUGGESTIONS;
  let completionSource = providerAlreadyStarted ? 'provider-started-recovery' : 'fallback';
  if (!providerAlreadyStarted) {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      await abandonClaim(admin, { clientRequestId, fingerprint, claimToken, expectedUserId: user!.id }, requestId);
      return errorResponse(requestId, 'provider_not_configured', 'Wingman đang được cấu hình. Vui lòng thử lại sau.', 503, true);
    }
    let rateValue: unknown;
    let rateError: { code?: string | null } | null = null;
    try {
      const result = await admin.rpc('claim_ai_rate_limit', {
        p_user_id: user!.id,
        p_scope: 'conversation_wingman',
        p_limit: RATE_LIMIT,
        p_window_seconds: RATE_WINDOW_SECONDS,
      });
      rateValue = result.data;
      rateError = result.error;
    } catch (error) {
      console.error(JSON.stringify({
        event: 'wingman_rate_limit_error',
        requestId,
        errorCode: error instanceof Error ? error.name : 'unknown',
      }));
      await abandonClaim(admin, { clientRequestId, fingerprint, claimToken, expectedUserId: user!.id }, requestId);
      return errorResponse(requestId, 'rate_limit_unavailable', 'Chưa kiểm tra được giới hạn Wingman.', 503, true, 2_000);
    }
    const rate = rowFrom(rateValue);
    if (rateError) {
      console.error(JSON.stringify({ event: 'wingman_rate_limit_error', requestId, code: rateError.code }));
      await abandonClaim(admin, { clientRequestId, fingerprint, claimToken, expectedUserId: user!.id }, requestId);
      return errorResponse(requestId, 'rate_limit_unavailable', 'Chưa kiểm tra được giới hạn Wingman.', 503, true, 2_000);
    }
    if (!rate?.allowed) {
      const resetAt = new Date(String(rate?.reset_at ?? '')).getTime();
      const retryAfterMs = Number.isFinite(resetAt) ? Math.max(1_000, resetAt - Date.now()) : 60_000;
      await abandonClaim(admin, { clientRequestId, fingerprint, claimToken, expectedUserId: user!.id }, requestId);
      return errorResponse(
        requestId,
        'wingman_rate_limited',
        'Bạn đã dùng Wingman khá nhiều. Vui lòng thử lại sau.',
        429,
        true,
        retryAfterMs,
      );
    }

    const { data: startedValue, error: startedError } = await admin.rpc(
      'mark_ai_assistant_provider_started' as never,
      {
        p_scope: 'conversation_wingman',
        p_client_request_id: clientRequestId,
        p_request_fingerprint: fingerprint,
        p_claim_token: claimToken,
        p_expected_user_id: user!.id,
      } as never,
    );
    if (startedError || startedValue !== true) {
      if (startedError) {
        await abandonClaim(admin, { clientRequestId, fingerprint, claimToken, expectedUserId: user!.id }, requestId);
      }
      return errorResponse(requestId, 'wingman_provider_fence_failed', 'Wingman chưa bắt đầu an toàn được.', 503, true, 2_000);
    }

    const model = Deno.env.get('OPENAI_MODEL') ?? DEFAULT_CHAT_MODEL;
    try {
      const raw = await structuredResponse({
        apiKey,
        model,
        system: WINGMAN_SYSTEM_PROMPT,
        user: providerPayload,
        schemaName: 'conversation_wingman_suggestions',
        schema: WINGMAN_RESPONSE_SCHEMA,
        deadlineMs: PROVIDER_DEADLINE_MS,
        maxAttempts: 1,
        maxOutputTokens: 700,
      });
      suggestions = parseWingmanSuggestions(raw);
      completionSource = `openai-${model}`;
    } catch (error) {
      completionSource = 'provider-fallback';
      console.warn(JSON.stringify({
        event: 'wingman_provider_failed',
        requestId,
        errorCode: error instanceof Error ? error.name : 'unknown',
        retryable: error instanceof OpenAIRequestError ? error.retryable : false,
      }));
    }
  }

  const responsePayload = { suggestions };
  const { data: finalizedValue, error: finalizeError } = await admin.rpc(
    'finalize_ai_assistant_request' as never,
    {
      p_scope: 'conversation_wingman',
      p_client_request_id: clientRequestId,
      p_request_fingerprint: fingerprint,
      p_claim_token: claimToken,
      p_response_payload: responsePayload,
      p_expected_user_id: user!.id,
    } as never,
  );
  if (finalizeError) {
    console.error(JSON.stringify({ event: 'wingman_finalize_failed', requestId, code: finalizeError.code }));
    return rpcErrorResponse(requestId, finalizeError, 'wingman_finalize_failed', 'Chưa lưu được gợi ý Wingman.');
  }
  const finalized = rowFrom(finalizedValue);
  const finalSuggestions = parseWingmanSuggestions(finalized?.response_payload ?? responsePayload);
  console.log(JSON.stringify({
    event: 'wingman_completed',
    requestId,
    userId: user!.id,
    messageCount: transcript.length,
    source: finalized?.request_status === 'cached' ? 'cached-race' : completionSource,
  }));
  return jsonResponse({
    ok: true,
    suggestions: finalSuggestions,
    cached: finalized?.request_status === 'cached',
  }, 200, requestId);
}

Deno.serve(req => {
  const requestId = requestIdFor(req);
  return handleWingman(req, requestId).catch(error => {
    console.error(JSON.stringify({
      event: 'wingman_unhandled_error',
      requestId,
      errorCode: error instanceof Error ? error.name : 'unknown',
    }));
    return errorResponse(requestId, 'wingman_failed', 'Wingman tạm thời chưa khả dụng.', 503, true, 2_000);
  });
});
