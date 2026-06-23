import { createServiceClient, jsonResponse, requireUser } from '../_shared/client.ts';

Deno.serve(async req => {
  const { client, user, response } = await requireUser(req);
  if (response) return response;
  const admin = createServiceClient();

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  if (!content) return jsonResponse({ error: 'content is required' }, 400);

  const hints = content
    .split(/[,.!?;\n]/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 4);

  const assistantContent = hints.length > 0
    ? `Saved. Future picks will account for: ${hints.join('; ')}.`
    : 'Saved. Tell me more when you want to tune future AI Picks.';

  const { error: chatError } = await admin.from('preference_chat_messages').insert([
    { user_id: user!.id, sender: 'user', content },
    { user_id: user!.id, sender: 'assistant', content: assistantContent },
  ]);
  if (chatError) return jsonResponse({ error: chatError.message }, 400);

  const { error: preferenceError } = await admin.from('preference_profiles').upsert({
    user_id: user!.id,
    summary: content,
    soft_preferences: hints,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (preferenceError) return jsonResponse({ error: preferenceError.message }, 400);

  return jsonResponse({ ok: true });
});
