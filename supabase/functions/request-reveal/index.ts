import { errorResponse, expectedUserFenceResponse, jsonObjectBody, jsonResponse, requireUser, rpcErrorResponse } from '../_shared/client.ts';

Deno.serve(async req => {
  const { client, user, requestId, response } = await requireUser(req);
  if (response) return response;

  const body = await jsonObjectBody(req);
  const expectedUserId = typeof body.expectedUserId === 'string' ? body.expectedUserId.trim() : '';
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId);
  if (fenceResponse) return fenceResponse;
  const sessionId = String(body.sessionId ?? '').trim().slice(0, 200);
  if (!sessionId) return errorResponse(requestId, 'invalid_session', 'sessionId is required.', 400);

  const { data, error } = await client.rpc('request_reveal_atomic' as never, {
    p_session_id: sessionId,
    p_expected_user_id: expectedUserId || null,
  } as never);
  if (error) {
    console.error(JSON.stringify({ event: 'reveal_failed', requestId, userId: user!.id, code: error.code }));
    return rpcErrorResponse(requestId, error, 'reveal_failed', 'Chưa lưu được yêu cầu tiết lộ.');
  }

  const result: any = Array.isArray(data) ? data[0] : data;
  const isRevealed = Boolean(result?.is_revealed);
  return jsonResponse({
    ok: true,
    accepted: Boolean(result?.accepted),
    isRevealed,
    partnerId: isRevealed ? result?.partner_id ?? null : null,
  }, 200, requestId);
});
