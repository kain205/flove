import type { MatchFeedbackDecision } from '@flove/core';
import type { FloveSupabaseClient } from './client';

export async function generateDailyMatches(client: FloveSupabaseClient, date?: string) {
  const { data, error } = await client.functions.invoke('generate-daily-matches', {
    body: { date },
  });
  if (error) throw error;
  return data as { ok: true; batchId: string; generatedBy?: string; matchCount?: number };
}

export async function submitMatchFeedback(
  client: FloveSupabaseClient,
  input: {
    matchId: string;
    decision: Exclude<MatchFeedbackDecision, 'accepted'>;
    tags?: string[];
    note?: string;
  }
) {
  const { data, error } = await client.functions.invoke('submit-match-feedback', {
    body: input,
  });
  if (error) throw error;
  return data as { ok: true };
}

export async function acceptCuratedMatch(
  client: FloveSupabaseClient,
  input: { matchId: string; tags?: string[]; note?: string }
) {
  const { data, error } = await client.functions.invoke('accept-curated-match', {
    body: input,
  });
  if (error) throw error;
  return data as { ok: true; isMutual: boolean; conversationId?: string };
}

export async function sendPreferenceChatMessage(client: FloveSupabaseClient, content: string) {
  const { data, error } = await client.functions.invoke('send-preference-chat-message', {
    body: { content },
  });
  if (error) throw error;
  return data as { ok: true };
}
