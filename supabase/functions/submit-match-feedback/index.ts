import { errorResponse, expectedUserFenceResponse, jsonObjectBody, jsonResponse, requireUser, rpcErrorResponse } from '../_shared/client.ts';

const allowed = new Set(['declined', 'skipped', 'reported']);

Deno.serve(async req => {
  const startedAt = performance.now();
  const { client, user, requestId, response } = await requireUser(req);
  if (response) return response;

  const body = await jsonObjectBody(req);
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId);
  if (fenceResponse) return fenceResponse;
  const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
  const decision = typeof body.decision === 'string' ? body.decision : '';
  if (!matchId || matchId.length > 240 || !allowed.has(decision)) {
    return errorResponse(requestId, 'invalid_feedback', 'Invalid match feedback payload.', 400);
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.slice(0, 10).map((tag: unknown) => String(tag).trim().slice(0, 60)).filter(Boolean)
    : [];
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1_000) : '';
  const suppliedKey = req.headers.get('idempotency-key') || body.idempotencyKey;
  const idempotencyKey = String(suppliedKey || `${matchId}:${decision}`).trim().slice(0, 200);

  const { data, error } = await client.rpc('submit_match_feedback_atomic' as never, {
    p_match_id: matchId,
    p_decision: decision,
    p_idempotency_key: idempotencyKey,
    p_tags: tags,
    p_note: note,
  } as never);
  if (error) {
    console.error(JSON.stringify({ event: 'feedback_failed', requestId, userId: user!.id, code: error.code }));
    return rpcErrorResponse(requestId, error, 'feedback_failed', 'Chưa lưu được phản hồi.');
  }

  const result = Array.isArray(data) ? data[0] : data;
  console.log(JSON.stringify({
    event: 'feedback_completed',
    requestId,
    userId: user!.id,
    decision,
    applied: Boolean((result as any)?.applied),
    durationMs: Math.round(performance.now() - startedAt),
  }));

  return jsonResponse({
    ok: true,
    applied: Boolean((result as any)?.applied),
    status: (result as any)?.status ?? decision,
    isMutual: Boolean((result as any)?.is_mutual),
    conversationId: (result as any)?.conversation_id ?? undefined,
  }, 200, requestId);
});
