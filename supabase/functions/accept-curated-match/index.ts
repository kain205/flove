import { jsonResponse, requireUser } from '../_shared/client.ts';

Deno.serve(async req => {
  const { client, response } = await requireUser(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const matchId = String(body.matchId ?? '');
  if (!matchId) return jsonResponse({ error: 'matchId is required' }, 400);

  const { data, error } = await client.rpc('accept_curated_match', {
    p_match_id: matchId,
    p_tags: Array.isArray(body.tags) ? body.tags : [],
    p_note: typeof body.note === 'string' ? body.note : '',
  });

  if (error) return jsonResponse({ error: error.message }, 400);
  const result = Array.isArray(data) ? data[0] : data;

  return jsonResponse({
    ok: true,
    isMutual: Boolean(result?.is_mutual),
    conversationId: result?.conversation_id ?? undefined,
  });
});
