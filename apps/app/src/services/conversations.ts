import {
  listConversationMessages,
  listConversationSummaries,
  markConversationRead,
  sendConversationMessage,
} from '@flove/supabase';
import { supabase } from '@/lib/supabase';

export const conversationSummariesQueryKey = (userId?: string) => (
  ['conversations', userId ?? 'signed-out'] as const
);
export const conversationMessagesQueryKey = (userId: string | undefined, conversationId: string) => (
  ['messages', userId ?? 'signed-out', conversationId] as const
);
export const conversationSummaryQueryKey = (userId: string | undefined, conversationId: string) => (
  ['conversation-summary', userId ?? 'signed-out', conversationId] as const
);

export function newClientMessageId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `message_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadConversationSummaries(limit = 50) {
  return listConversationSummaries(supabase, undefined, limit);
}

export async function loadConversationSummary(conversationId: string) {
  const rows = await listConversationSummaries(supabase, conversationId, 1);
  if (!rows[0]) throw new Error('Cuộc trò chuyện không còn khả dụng.');
  return rows[0];
}

export function loadConversationMessages(conversationId: string, limit = 200) {
  return listConversationMessages(supabase, conversationId, limit);
}

export function acknowledgeConversation(conversationId: string) {
  return markConversationRead(supabase, conversationId);
}

export function sendSharedMessage(input: {
  conversationId: string;
  content: string;
  clientMessageId: string;
  expectedUserId: string;
}) {
  return sendConversationMessage(supabase, input);
}
