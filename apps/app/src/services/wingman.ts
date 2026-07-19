import { isApiFailure, type ApiFailure } from '@flove/core';
import { ApiRequestError } from '@flove/supabase';
import { supabase } from '@/lib/supabase';

const MAX_DRAFT_CHARACTERS = 2_000;
const MAX_SUGGESTION_CHARACTERS = 280;

export type WingmanRequest = {
  conversationId: string;
  draft: string;
  idempotencyKey: string;
  userId: string;
};

export type WingmanResult = {
  suggestions: [string, string, string];
  cached: boolean;
};

async function failureFromInvokeError(error: unknown): Promise<ApiFailure | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof (context as { clone?: unknown }).clone !== 'function') return null;
  try {
    const cloned = (context as { clone(): { json(): Promise<unknown> } }).clone();
    const payload: unknown = await cloned.json();
    return isApiFailure(payload) ? payload : null;
  } catch {
    return null;
  }
}

function parseSuggestions(value: unknown): [string, string, string] {
  if (!Array.isArray(value) || value.length !== 3) throw new Error('Kết quả Wingman không hợp lệ.');
  const suggestions = value.map(item => {
    if (typeof item !== 'string') throw new Error('Kết quả Wingman không hợp lệ.');
    const text = item.replace(/\s+/g, ' ').trim();
    if (!text || text.length > MAX_SUGGESTION_CHARACTERS) throw new Error('Kết quả Wingman không hợp lệ.');
    return text;
  });
  if (new Set(suggestions.map(item => item.normalize('NFKC').toLocaleLowerCase('vi'))).size !== 3) {
    throw new Error('Kết quả Wingman không hợp lệ.');
  }
  return suggestions as [string, string, string];
}

export function newWingmanRequestId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `wingman_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function askConversationWingman(input: WingmanRequest): Promise<WingmanResult> {
  if (!input.conversationId.trim()) throw new Error('Cuộc trò chuyện không hợp lệ.');
  if (input.draft.length > MAX_DRAFT_CHARACTERS) {
    throw new Error(`Wingman chỉ đọc tối đa ${MAX_DRAFT_CHARACTERS} ký tự trong nội dung đang soạn.`);
  }
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Bạn cần đăng nhập để dùng Wingman.');
  if (auth.user.id !== input.userId) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');

  const { data, error } = await supabase.functions.invoke('ask-conversation-wingman', {
    body: {
      conversationId: input.conversationId,
      draft: input.draft,
      expectedUserId: input.userId,
      idempotencyKey: input.idempotencyKey,
    },
    headers: { 'idempotency-key': input.idempotencyKey },
  });
  if (error) {
    const failure = await failureFromInvokeError(error);
    if (failure) throw new ApiRequestError(failure);
    throw error;
  }
  if (isApiFailure(data)) throw new ApiRequestError(data);
  const row = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  return {
    suggestions: parseSuggestions(row.suggestions),
    cached: row.cached === true,
  };
}
