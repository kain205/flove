import { describe, expect, it } from 'vitest';
import { userProfileFromRow } from './mappers';
import type { ProfileRow } from './database.types';

describe('@flove/supabase mappers', () => {
  it('maps profile rows to core profile shape', () => {
    const row: ProfileRow = {
      id: 'u1',
      email: 'u1@fpt.edu.vn',
      name: 'User',
      age: 21,
      major: 'SE',
      campus: 'HCM',
      avatar_url: '',
      bio: 'Bio',
      interests: ['Coding', 'Coffee', 'Music'],
      personality_tags: ['Chill'],
      dating_goals: ['Coffee dates'],
      preferred_vibes: ['Deep talks'],
      profile_text: { bio: 'Bio' },
      profile_completeness: 100,
      onboarding_source: 'manual',
      ai_signals: {},
      created_at: '2026-06-23T00:00:00.000Z',
      updated_at: '2026-06-23T00:00:00.000Z',
    };

    expect(userProfileFromRow(row)).toMatchObject({
      id: 'u1',
      avatarUrl: '',
      personalityTags: ['Chill'],
    });
  });
});
