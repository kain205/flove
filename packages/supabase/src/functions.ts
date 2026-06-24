import type { AIProfileAnalysis, MatchFeedbackDecision } from '@flove/core';
import type { FloveSupabaseClient } from './client';

export interface OnboardingAnswerInput {
  questionId: string;
  value: string | string[];
}

export interface OnboardingBasicInput {
  name?: string;
  age?: number;
  gender?: string;
  genderText?: string;
  lookingForGender?: string[];
  heightCm?: number | null;
  school?: string;
  majorLabel?: string;
  major?: string;
  campus?: string;
  avatarUrl?: string;
  agePrefMin?: number | null;
  agePrefMax?: number | null;
}

export async function generateDailyMatches(client: FloveSupabaseClient, date?: string) {
  const { data, error } = await client.functions.invoke('generate-daily-matches', {
    body: { date },
  });
  if (error) throw error;
  return data as { ok: true; batchId: string; generatedBy?: string; matchCount?: number };
}

/** Runs the one-shot LLM profile analysis (no DB write) for the review screen. */
export async function analyzeOnboardingProfile(
  client: FloveSupabaseClient,
  input: { answers: OnboardingAnswerInput[]; basic: OnboardingBasicInput }
) {
  const { data, error } = await client.functions.invoke('analyze-onboarding-profile', {
    body: input,
  });
  if (error) throw error;
  return data as { analysis: AIProfileAnalysis; generatedBy: string };
}

/** Persists the confirmed profile + embeddings and unlocks AI Picks. */
export async function confirmOnboardingProfile(
  client: FloveSupabaseClient,
  input: { analysis: AIProfileAnalysis; basic: OnboardingBasicInput; answers: OnboardingAnswerInput[] }
) {
  const { data, error } = await client.functions.invoke('confirm-onboarding-profile', {
    body: input,
  });
  if (error) throw error;
  return data as { ok: true; profileCompleteness: number; embedded: boolean };
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
