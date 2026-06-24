import type { ProfileText, UserProfile } from './types';
import { hasCompletedOnboarding } from './onboarding';

export const INTERESTS = [
  'Coding', 'Gaming', 'Music', 'Photography', 'Travel',
  'Reading', 'Sports', 'Art', 'Coffee', 'Movies',
  'Yoga', 'Dance', 'Cooking', 'AI/ML', 'Startups',
  'Fashion', 'Basketball', 'Finance', 'Marketing',
] as const;

export const PERSONALITY_TAGS = [
  'Chill', 'Thoughtful', 'Funny', 'Ambitious', 'Introvert',
  'Extrovert', 'Creative', 'Curious', 'Calm', 'Energetic',
] as const;

export const DATING_GOALS = [
  'Serious dating', 'Slow connection', 'Coffee dates',
  'Study partner', 'Weekend hangouts', 'New friends first',
] as const;

export const PREFERRED_VIBES = [
  'Deep talks', 'Same campus', 'Same major', 'Easy-going',
  'Creative energy', 'Career-minded', 'Quiet dates', 'Active plans',
] as const;

export type ProfileRequirementId =
  | 'name'
  | 'age'
  | 'campus'
  | 'major'
  | 'interests'
  | 'personalityTags'
  | 'datingGoals'
  | 'profileText'
  | 'onboardingSignals';

export interface ProfileReadinessRequirement {
  id: ProfileRequirementId;
  isMet: boolean;
}

export interface ProfileReadiness {
  completeness: number;
  isComplete: boolean;
  requirements: ProfileReadinessRequirement[];
  missing: ProfileReadinessRequirement[];
  signalCount: number;
}

export function normalizeProfileText(user: Partial<UserProfile>): ProfileText {
  return {
    bio: user.profileText?.bio ?? user.bio ?? '',
    school: user.profileText?.school ?? '',
    majorLabel: user.profileText?.majorLabel ?? '',
    weekendStyle: user.profileText?.weekendStyle ?? '',
    conversationStyle: user.profileText?.conversationStyle ?? '',
    memorableThing: user.profileText?.memorableThing ?? '',
    relationshipIntent: user.profileText?.relationshipIntent ?? '',
  };
}

export function profileSignalCount(user: Partial<UserProfile>): number {
  const profileText = normalizeProfileText(user);
  return [
    profileText.bio,
    profileText.weekendStyle,
    profileText.conversationStyle,
    profileText.memorableThing,
    profileText.relationshipIntent,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).length;
}

export function calculateProfileCompleteness(user: Partial<UserProfile>): number {
  const checks = [
    Boolean(user.name?.trim()),
    Boolean(user.age && user.age >= 17),
    Boolean(user.campus),
    Boolean(user.major),
    (user.interests?.length ?? 0) >= 3,
    (user.personalityTags?.length ?? 0) >= 1,
    (user.datingGoals?.length ?? 0) >= 1,
    profileSignalCount(user) >= 1,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function getProfileReadiness(user: Partial<UserProfile>): ProfileReadiness {
  const signalCount = profileSignalCount(user);
  const requirements: ProfileReadinessRequirement[] = [
    { id: 'name', isMet: Boolean(user.name?.trim()) },
    { id: 'age', isMet: Boolean(user.age && user.age >= 17) },
    { id: 'campus', isMet: Boolean(user.campus) },
    { id: 'major', isMet: Boolean(user.major) },
    { id: 'interests', isMet: (user.interests?.length ?? 0) >= 3 },
    { id: 'personalityTags', isMet: (user.personalityTags?.length ?? 0) >= 1 },
    { id: 'datingGoals', isMet: (user.datingGoals?.length ?? 0) >= 1 },
    { id: 'profileText', isMet: signalCount >= 1 },
    { id: 'onboardingSignals', isMet: hasCompletedOnboarding(user.aiSignals) },
  ];
  const completeness = calculateProfileCompleteness(user);
  const isComplete = completeness >= 75
    && requirements.find(requirement => requirement.id === 'age')?.isMet
    && requirements.find(requirement => requirement.id === 'interests')?.isMet
    && requirements.find(requirement => requirement.id === 'profileText')?.isMet
    && requirements.find(requirement => requirement.id === 'onboardingSignals')?.isMet;

  return {
    completeness,
    isComplete: Boolean(isComplete),
    requirements,
    missing: requirements.filter(requirement => !requirement.isMet),
    signalCount,
  };
}
