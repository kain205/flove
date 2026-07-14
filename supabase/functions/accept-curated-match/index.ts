import { errorResponse, expectedUserFenceResponse, jsonObjectBody, jsonResponse, requireUser, rpcErrorResponse } from '../_shared/client.ts';

Deno.serve(async req => {
  const { client, user, requestId, response } = await requireUser(req);
  if (response) return response;

  const body = await jsonObjectBody(req);
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId);
  if (fenceResponse) return fenceResponse;
  const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
  if (!matchId || matchId.length > 240) {
    return errorResponse(requestId, 'invalid_match', 'matchId must contain at most 240 characters.', 400);
  }
  const tags = Array.isArray(body.tags)
    ? body.tags.slice(0, 10).map((tag: unknown) => String(tag).trim().slice(0, 60)).filter(Boolean)
    : [];
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1_000) : '';
  const suppliedKey = req.headers.get('idempotency-key') || body.idempotencyKey;
  const idempotencyKey = String(suppliedKey || `${matchId}:accepted`).trim().slice(0, 200);

  const { data, error } = await client.rpc('submit_match_feedback_atomic' as never, {
    p_match_id: matchId,
    p_decision: 'accepted',
    p_idempotency_key: idempotencyKey,
    p_tags: tags,
    p_note: note,
  } as never);

  if (error) {
    console.error(JSON.stringify({ event: 'accept_failed', requestId, userId: user!.id, code: error.code }));
    return rpcErrorResponse(requestId, error, 'accept_failed', 'Chưa lưu được lựa chọn.');
  }
  const result = Array.isArray(data) ? data[0] : data;

  return jsonResponse({
    ok: true,
    applied: Boolean((result as any)?.applied),
    isMutual: Boolean(result?.is_mutual),
    conversationId: result?.conversation_id ?? undefined,
  }, 200, requestId);
});
