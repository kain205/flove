import { aiBackendService } from '@/services/aiBackendService';
import type {
  CuratedMatch,
  DailyMatchBatch,
  MatchFeedbackDecision,
  PreferenceProfile,
} from '@/types';
import type { MatchingGateway } from './types';
import {
  currentUid,
  getPreferenceProfileForUid,
  localDateKey,
  readCuratedMatch,
  readDailyMatchBatch,
} from './localFirestoreMatchingGateway';

export const functionsMatchingGateway: MatchingGateway = {
  async getTodayMatches(): Promise<DailyMatchBatch> {
    const uid = currentUid();
    const date = localDateKey();
    const existing = await readDailyMatchBatch(uid, date);
    if (existing) return existing;

    await aiBackendService.generateDailyMatches(date);
    const generated = await readDailyMatchBatch(uid, date);
    if (!generated) throw new Error('Functions backend did not create today match batch');
    return generated;
  },

  async submitFeedback(
    matchId: string,
    decision: Exclude<MatchFeedbackDecision, 'accepted'>,
    tags: string[],
    note?: string
  ): Promise<CuratedMatch> {
    await aiBackendService.submitMatchFeedback(matchId, decision, tags, note);
    return readCuratedMatch(matchId);
  },

  async acceptMatch(
    matchId: string,
    tags: string[] = [],
    note?: string
  ): Promise<{ isMutual: boolean; conversationId?: string; match: CuratedMatch }> {
    await aiBackendService.acceptCuratedMatch(matchId, tags, note);
    const match = await readCuratedMatch(matchId);
    return {
      isMutual: match.status === 'matched',
      conversationId: match.status === 'matched' ? `conversation_${match.pairKey}` : undefined,
      match,
    };
  },

  async getPreferenceProfile(): Promise<PreferenceProfile> {
    return getPreferenceProfileForUid(currentUid());
  },
};
