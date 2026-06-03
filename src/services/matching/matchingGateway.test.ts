import { describe, expect, it, vi } from 'vitest';
import { resolveMatchingBackend, selectMatchingGateway } from './matchingGateway';
import type { MatchingGateway } from './types';

function makeGateway(): MatchingGateway {
  return {
    getTodayMatches: vi.fn(),
    submitFeedback: vi.fn(),
    acceptMatch: vi.fn(),
    getPreferenceProfile: vi.fn(),
  };
}

describe('matching gateway selection', () => {
  it('selects the Functions adapter when the env flag is enabled', () => {
    const functions = makeGateway();
    const local = makeGateway();

    expect(selectMatchingGateway('functions', { functions, local })).toBe(functions);
  });

  it('defaults to the local adapter for demo and development', () => {
    expect(resolveMatchingBackend(undefined)).toBe('local');
    expect(resolveMatchingBackend('anything-else')).toBe('local');
  });
});
