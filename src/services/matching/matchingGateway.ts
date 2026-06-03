import { isMockMode, mockService } from '@/services/mockService';
import type { MatchingGateway } from './types';
import { functionsMatchingGateway } from './functionsMatchingGateway';
import { localFirestoreMatchingGateway } from './localFirestoreMatchingGateway';

export type MatchingBackend = 'functions' | 'local';

interface MatchingGatewayAdapters {
  functions: MatchingGateway;
  local: MatchingGateway;
}

const defaultAdapters: MatchingGatewayAdapters = {
  functions: functionsMatchingGateway,
  local: localFirestoreMatchingGateway,
};

function isMockMatchId(matchId: string): boolean {
  return matchId.startsWith('mock-');
}

export function resolveMatchingBackend(value?: string): MatchingBackend {
  return value === 'functions' ? 'functions' : 'local';
}

export function selectMatchingGateway(
  backend: string | undefined,
  adapters: MatchingGatewayAdapters = defaultAdapters
): MatchingGateway {
  return adapters[resolveMatchingBackend(backend)];
}

export function getMatchingGateway(): MatchingGateway {
  return selectMatchingGateway(import.meta.env.VITE_AI_MATCH_BACKEND);
}

export const curatedMatchService: MatchingGateway = {
  async getTodayMatches() {
    if (isMockMode()) {
      return mockService.getTodayMatches();
    }

    return getMatchingGateway().getTodayMatches();
  },

  async submitFeedback(matchId, decision, tags, note) {
    if (isMockMode() || isMockMatchId(matchId)) {
      return mockService.submitFeedback(matchId, decision, tags, note);
    }

    return getMatchingGateway().submitFeedback(matchId, decision, tags, note);
  },

  async acceptMatch(matchId, tags = [], note) {
    if (isMockMode() || isMockMatchId(matchId)) {
      return mockService.acceptMatch(matchId, tags, note);
    }

    return getMatchingGateway().acceptMatch(matchId, tags, note);
  },

  async getPreferenceProfile() {
    if (isMockMode()) {
      return mockService.getPreferenceProfile();
    }

    return getMatchingGateway().getPreferenceProfile();
  },
};
