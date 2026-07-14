import { getPreferenceChatMessages, sendPreferenceChatMessage } from '@flove/supabase';
import { supabase } from '@/lib/supabase';

export const preferenceChatQueryKey = (userId: string | null | undefined) =>
  ['preference-chat-messages', userId ?? 'anonymous'] as const;

export const preferenceProfileQueryKey = (userId: string | null | undefined) =>
  ['preference-profile', userId ?? 'anonymous'] as const;

export function loadPreferenceChatMessages(userId: string) {
  return getPreferenceChatMessages(supabase, userId);
}

export async function sendPreferenceChat(input: { content: string; idempotencyKey: string; userId: string }) {
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) throw new Error('Not authenticated');
  if (auth.user.id !== input.userId) throw new Error('Session changed while sending preference chat.');
  return sendPreferenceChatMessage(supabase, input.content, input.idempotencyKey, input.userId);
}
