import { errorResponse, expectedUserFenceResponse, jsonObjectBody, jsonResponse, requireUser, rpcErrorResponse } from '../_shared/client.ts';
import { extractMatchingTextTags } from '../_shared/analysis.ts';

Deno.serve(async req => {
  const { client, user, requestId, response } = await requireUser(req);
  if (response) return response;

  const body = await jsonObjectBody(req);
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId);
  if (fenceResponse) return fenceResponse;
  const rawContent = typeof body.content === 'string' ? body.content : '';
  const content = rawContent.trim();
  if (!content || content.length > 2_000) {
    return errorResponse(requestId, 'invalid_content', 'content must contain 1–2000 characters.', 400);
  }

  const hints = extractMatchingTextTags(content, 20);

  const assistantContent = hints.length > 0
    ? `Saved. Future picks will account for: ${hints.slice(0, 4).join('; ')}.`
    : 'Saved. Tell me more when you want to tune future AI Picks.';

  const suppliedKey = req.headers.get('idempotency-key') || body.idempotencyKey;
  const clientRequestId = String(suppliedKey || requestId).trim().slice(0, 200);
  const { data, error } = await client.rpc('save_preference_chat_turn_atomic' as never, {
    p_content: content,
    p_hints: hints,
    p_assistant_content: assistantContent,
    p_request_id: clientRequestId,
  } as never);
  if (error) {
    console.error(JSON.stringify({ event: 'preference_chat_failed', requestId, userId: user!.id, code: error.code }));
    return rpcErrorResponse(requestId, error, 'preference_chat_failed', 'Chưa lưu được tùy chỉnh gợi ý.');
  }
  const result: any = Array.isArray(data) ? data[0] : data;

  return jsonResponse({ ok: true, applied: Boolean(result?.applied) }, 200, requestId);
});
