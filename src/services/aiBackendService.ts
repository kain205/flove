import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/lib/firebase';

const USE_FUNCTIONS = import.meta.env.VITE_AI_MATCH_BACKEND === 'functions';

function functionsClient() {
  return getFunctions(firebaseApp);
}

export const aiBackendService = {
  isEnabled(): boolean {
    return USE_FUNCTIONS;
  },

  async generateDailyMatches(date: string): Promise<boolean> {
    if (!USE_FUNCTIONS) return false;

    const callable = httpsCallable(functionsClient(), 'generateDailyMatches');
    await callable({ date });
    return true;
  },

  async submitMatchFeedback(
    matchId: string,
    decision: string,
    tags: string[],
    note?: string
  ): Promise<boolean> {
    if (!USE_FUNCTIONS) return false;

    const callable = httpsCallable(functionsClient(), 'submitMatchFeedback');
    await callable({ matchId, decision, tags, note });
    return true;
  },

  async acceptCuratedMatch(matchId: string, tags: string[] = [], note?: string): Promise<boolean> {
    if (!USE_FUNCTIONS) return false;

    const callable = httpsCallable(functionsClient(), 'acceptCuratedMatch');
    await callable({ matchId, tags, note });
    return true;
  },

  async sendPreferenceChatMessage(content: string): Promise<boolean> {
    if (!USE_FUNCTIONS) return false;

    const callable = httpsCallable(functionsClient(), 'sendPreferenceChatMessage');
    await callable({ content });
    return true;
  },
};
