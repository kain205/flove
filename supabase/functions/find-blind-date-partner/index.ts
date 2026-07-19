import { errorResponse, expectedUserFenceResponse, jsonObjectBody, jsonResponse, requireUser, rpcErrorResponse } from '../_shared/client.ts';

const names = ['Anonymous Student', 'Quiet Coder', 'Campus Explorer', 'Coffee Match'];

Deno.serve(async req => {
  const startedAt = performance.now();
  const { client, user, requestId, response } = await requireUser(req);
  if (response) return response;

  const body = await jsonObjectBody(req);
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId);
  if (fenceResponse) return fenceResponse;

  const maskedName = names[Math.floor(Math.random() * names.length)];
  const { data, error } = await client.rpc('find_blind_date_partner_atomic' as never, {
    p_masked_name: maskedName,
  } as never);
  if (error) {
    console.error(JSON.stringify({ event: 'blind_date_failed', requestId, userId: user!.id, code: error.code }));
    return rpcErrorResponse(requestId, error, 'blind_date_failed', 'Chưa thể ghép Blind Date lúc này.');
  }

  const result: any = Array.isArray(data) ? data[0] : data;
  if (!result) return errorResponse(requestId, 'blind_date_failed', 'No queue result returned.', 500, true);
  const waiting = Boolean(result.waiting);

  console.log(JSON.stringify({
    event: 'blind_date_completed',
    requestId,
    userId: user!.id,
    waiting,
    durationMs: Math.round(performance.now() - startedAt),
  }));

  return jsonResponse({
    ok: true,
    waiting,
    sessionId: result.session_id ?? null,
    conversationId: result.conversation_id ?? undefined,
    ...(waiting ? {} : { partnerMaskedName: result.partner_masked_name ?? maskedName }),
  }, 200, requestId);
});
