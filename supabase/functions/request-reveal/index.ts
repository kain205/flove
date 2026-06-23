import { createServiceClient, jsonResponse, requireUser } from '../_shared/client.ts';

Deno.serve(async req => {
  const { client, user, response } = await requireUser(req);
  if (response) return response;
  const admin = createServiceClient();

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body.sessionId ?? '');
  if (!sessionId) return jsonResponse({ error: 'sessionId is required' }, 400);

  const { data: session, error } = await client
    .from('blind_date_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (error) return jsonResponse({ error: error.message }, 404);
  if (!session.user_ids.includes(user!.id)) return jsonResponse({ error: 'Forbidden' }, 403);

  const revealRequests = {
    ...(session.reveal_requests ?? {}),
    [user!.id]: true,
  };
  const accepted = session.user_ids.every((id: string) => revealRequests[id]);

  const { error: updateError } = await admin
    .from('blind_date_sessions')
    .update({ reveal_requests: revealRequests, is_revealed: accepted })
    .eq('id', sessionId);
  if (updateError) return jsonResponse({ error: updateError.message }, 400);

  return jsonResponse({ ok: true, accepted });
});
