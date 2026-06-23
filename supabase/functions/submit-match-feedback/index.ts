import { createServiceClient, jsonResponse, requireUser } from '../_shared/client.ts';

const allowed = new Set(['declined', 'skipped', 'reported']);

Deno.serve(async req => {
  const { client, user, response } = await requireUser(req);
  if (response) return response;
  const admin = createServiceClient();

  const body = await req.json().catch(() => ({}));
  const matchId = String(body.matchId ?? '');
  const decision = String(body.decision ?? '');
  if (!matchId || !allowed.has(decision)) {
    return jsonResponse({ error: 'Invalid match feedback payload' }, 400);
  }

  const { data: match, error: matchError } = await client
    .from('curated_matches')
    .select('id,user_id,candidate_id')
    .eq('id', matchId)
    .single();
  if (matchError) return jsonResponse({ error: matchError.message }, 404);
  if (match.user_id !== user!.id) return jsonResponse({ error: 'Forbidden' }, 403);

  const tags = Array.isArray(body.tags) ? body.tags : [];
  const note = typeof body.note === 'string' ? body.note : '';

  const { error: feedbackError } = await admin.from('match_feedback').insert({
    match_id: matchId,
    user_id: user!.id,
    candidate_id: match.candidate_id,
    decision,
    tags,
    note,
  });
  if (feedbackError) return jsonResponse({ error: feedbackError.message }, 400);

  const { error: updateError } = await admin
    .from('curated_matches')
    .update({
      status: decision,
      feedback_tags: tags,
      feedback_note: note,
      decided_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('user_id', user!.id);
  if (updateError) return jsonResponse({ error: updateError.message }, 400);

  return jsonResponse({ ok: true });
});
