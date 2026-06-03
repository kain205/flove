import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AiPicksPage from './AiPicksPage';
import type { MatchingGateway } from '@/services/curatedMatchService';
import { makeUser } from '@/test/factories';

function makeGateway(): MatchingGateway {
  return {
    getTodayMatches: vi.fn(),
    submitFeedback: vi.fn(),
    acceptMatch: vi.fn(),
    getPreferenceProfile: vi.fn(),
  };
}

describe('AiPicksPage', () => {
  it('does not load matching data for incomplete profiles', () => {
    const matchingGateway = makeGateway();

    render(
      <AiPicksPage
        user={makeUser({
          age: 0,
          interests: [],
          personalityTags: [],
          datingGoals: [],
          bio: '',
          profileText: {
            bio: '',
            weekendStyle: '',
            conversationStyle: '',
            memorableThing: '',
            relationshipIntent: '',
          },
          profileCompleteness: 0,
        })}
        onNavigateToMessages={vi.fn()}
        onNavigateToProfile={vi.fn()}
        matchingGateway={matchingGateway}
      />
    );

    expect(screen.getByText('Profile completeness')).toBeInTheDocument();
    expect(matchingGateway.getTodayMatches).not.toHaveBeenCalled();
  });
});
