import type {
  CuratedMatch,
  DailyMatchBatch,
  MatchFeedbackDecision,
  PreferenceProfile,
} from '@/types';

export interface MatchingGateway {
  getTodayMatches(): Promise<DailyMatchBatch>;
  submitFeedback(
    matchId: string,
    decision: Exclude<MatchFeedbackDecision, 'accepted'>,
    tags: string[],
    note?: string
  ): Promise<CuratedMatch>;
  acceptMatch(
    matchId: string,
    tags?: string[],
    note?: string
  ): Promise<{ isMutual: boolean; conversationId?: string; match: CuratedMatch }>;
  getPreferenceProfile(): Promise<PreferenceProfile>;
}
