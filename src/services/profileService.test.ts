import { describe, expect, it } from 'vitest';
import {
  buildProfileSavePayload,
  getProfileReadiness,
  stripUndefinedFields,
} from './profileService';
import { makeUser } from '@/test/factories';
import type { User } from '@/types';

describe('profile readiness', () => {
  it('does not mark incomplete profiles ready for matching', () => {
    const readiness = getProfileReadiness(makeUser({
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
    }));

    expect(readiness.isComplete).toBe(false);
    expect(readiness.missing.map(requirement => requirement.id)).toContain('interests');
    expect(readiness.missing.map(requirement => requirement.id)).toContain('profileText');
  });
});

describe('profile save payload', () => {
  it('strips undefined values before saving', () => {
    expect(stripUndefinedFields({
      keep: 'value',
      drop: undefined,
      nested: {
        keep: true,
        drop: undefined,
      },
    })).toEqual({
      keep: 'value',
      nested: {
        keep: true,
      },
    });
  });

  it('omits immutable user fields and undefined update fields', () => {
    const payload = buildProfileSavePayload(makeUser(), {
      id: 'other-user',
      email: 'other@fpt.edu.vn',
      name: 'Updated User',
      personalityTags: undefined,
    } as Partial<User>);

    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('personalityTags');
    expect(payload.name).toBe('Updated User');
  });
});
