import type { User } from '@/types';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@fpt.edu.vn',
    name: 'Shell User',
    age: 21,
    major: 'SE',
    campus: 'HCM',
    avatar: '',
    bio: 'Likes coffee and useful software.',
    interests: ['Coding', 'Coffee', 'Music'],
    personalityTags: ['Curious'],
    datingGoals: ['Coffee dates'],
    preferredVibes: ['Deep talks'],
    profileText: {
      bio: 'Likes coffee and useful software.',
      weekendStyle: 'Cafe or side projects.',
      conversationStyle: 'Calm and direct.',
      memorableThing: 'Easy to talk to.',
      relationshipIntent: 'Start as friends.',
    },
    profileCompleteness: 100,
    ...overrides,
  };
}
