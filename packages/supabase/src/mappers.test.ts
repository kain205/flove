import { describe, expect, it } from 'vitest';
import { userProfileFromRow } from './mappers';
import type { Database } from './database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// Notebook-onboarding columns with neutral defaults, shared by the fixtures below.
const notebookColumns = {
  gender: 'prefer_not_to_show' as const,
  gender_text: null,
  looking_for_gender: [],
  height_cm: null,
  age_pref_min: null,
  age_pref_max: null,
  appearance_preference: {},
  dealbreakers: [],
  ai_profile_analysis: {},
  profile_confirmed: false,
  profile_confirmed_at: null,
  self_vector: null,
  need_vector: null,
  preference_vector: null,
  communication_vector: null,
  lifestyle_vector: null,
};

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
      ai_signals: {
        onboarding: {
          rawAnswers: [
            { questionId: 'intent', value: ['Mối quan hệ nghiêm túc'], answeredAt: '2026-06-23T00:00:00.000Z' },
          ],
          extractedTraits: {
            intents: ['serious_relationship'],
            values: {},
            interests: [],
            lifestyle: {},
            communication: {},
            personality: {},
            dealbreakers: [],
            preferredPartnerTraits: [],
            vibeTags: [],
            confidence: 0.4,
            version: 'onboarding_v1',
          },
          completedAt: '2026-06-23T00:00:00.000Z',
        },
      },
      created_at: '2026-06-23T00:00:00.000Z',
      updated_at: '2026-06-23T00:00:00.000Z',
      ...notebookColumns,
    };

    expect(userProfileFromRow(row)).toMatchObject({
      id: 'u1',
      avatarUrl: '',
      personalityTags: ['Chill'],
      aiSignals: {
        onboarding: {
          extractedTraits: {
            intents: ['serious_relationship'],
          },
        },
      },
    });
  });

  it('handles missing ai_signals safely', () => {
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
      ai_signals: null,
      created_at: '2026-06-23T00:00:00.000Z',
      updated_at: '2026-06-23T00:00:00.000Z',
      ...notebookColumns,
    };

    expect(userProfileFromRow(row).aiSignals).toBeUndefined();
  });
});
