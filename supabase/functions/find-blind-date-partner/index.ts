import { createServiceClient, jsonResponse, requireUser } from '../_shared/client.ts';

const names = ['Anonymous FPT Student', 'Quiet Coder', 'Campus Explorer', 'Coffee Match'];

Deno.serve(async req => {
  const { client, user, response } = await requireUser(req);
  if (response) return response;
  const admin = createServiceClient();

  const maskedName = names[Math.floor(Math.random() * names.length)];
  const { data: waiting } = await client
    .from('blind_date_queue')
    .select('user_id,masked_name')
    .eq('status', 'waiting')
    .neq('user_id', user!.id)
    .limit(1)
    .maybeSingle();

  if (!waiting) {
    const { error } = await admin.from('blind_date_queue').upsert({
      user_id: user!.id,
      masked_name: maskedName,
      status: 'waiting',
      queued_at: new Date().toISOString(),
    });
    if (error) return jsonResponse({ error: error.message }, 400);

    return jsonResponse({
      ok: true,
      waiting: true,
      sessionId: null,
      partnerId: null,
      partnerMaskedName: maskedName,
    });
  }

  const pair = [user!.id, waiting.user_id].sort();
  const sessionId = `blind_${pair.join('_')}_${Date.now()}`;
  const conversationId = `blind_conversation_${pair.join('_')}_${Date.now()}`;

  const { error: conversationError } = await admin.from('conversations').insert({
    id: conversationId,
    is_anonymous: true,
  });
  if (conversationError) return jsonResponse({ error: conversationError.message }, 400);

  const { error: participantError } = await admin.from('conversation_participants').insert([
    { conversation_id: conversationId, user_id: user!.id, masked_name: maskedName },
    { conversation_id: conversationId, user_id: waiting.user_id, masked_name: waiting.masked_name },
  ]);
  if (participantError) return jsonResponse({ error: participantError.message }, 400);

  const { error: sessionError } = await admin.from('blind_date_sessions').insert({
    id: sessionId,
    conversation_id: conversationId,
    user_ids: pair,
    partner_masked_names: {
      [user!.id]: waiting.masked_name,
      [waiting.user_id]: maskedName,
    },
  });
  if (sessionError) return jsonResponse({ error: sessionError.message }, 400);

  await admin.from('blind_date_queue').update({ status: 'matched' }).in('user_id', pair);

  return jsonResponse({
    ok: true,
    waiting: false,
    sessionId,
    conversationId,
    partnerId: waiting.user_id,
    partnerMaskedName: waiting.masked_name,
  });
});
