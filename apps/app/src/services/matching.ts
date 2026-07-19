import { acceptCuratedMatch, ensureDailyMatches, submitMatchFeedback, unlockDailyMatchBatch } from '@flove/supabase';
import { supabase } from '@/lib/supabase';
import type { MatchFeedbackDecision } from '@flove/core';

export function ensureTodayMatches(userId: string) {
  return ensureDailyMatches(supabase, userId);
}

export type PickDecision = Extract<MatchFeedbackDecision, 'accepted' | 'declined' | 'skipped' | 'reported'>;

export function actOnPick(input: { matchId: string; decision: PickDecision; userId: string }) {
  const idempotencyKey = `${input.matchId}:${input.decision}`;
  if (input.decision === 'accepted') {
    return acceptCuratedMatch(supabase, {
      matchId: input.matchId,
      idempotencyKey,
      expectedUserId: input.userId,
    });
  }
  return submitMatchFeedback(supabase, {
    matchId: input.matchId,
    decision: input.decision,
    idempotencyKey,
    expectedUserId: input.userId,
  });
}

export function unlockTodayMatchBatch(batchId: string, userId: string) {
  return unlockDailyMatchBatch(supabase, {
    batchId,
    expectedUserId: userId,
    idempotencyKey: `${batchId}:simulated-unlock:v1`,
  });
}

export const acceptPick = (matchId: string, userId: string) => actOnPick({ matchId, decision: 'accepted', userId });
export const declinePick = (matchId: string, userId: string) => actOnPick({ matchId, decision: 'declined', userId });
export const skipPick = (matchId: string, userId: string) => actOnPick({ matchId, decision: 'skipped', userId });
