import { User } from '@/types';

export const CAMPUSES = ['HCM', 'Hanoi', 'Danang', 'Cantho'] as const;
export const MAJORS = ['SE', 'AI', 'Biz', 'Design', 'Marketing'] as const;

export const INTERESTS = [
  'Coding', 'Gaming', 'Music', 'Photography', 'Travel',
  'Reading', 'Sports', 'Art', 'Coffee', 'Movies',
  'Yoga', 'Dance', 'Cooking', 'AI/ML', 'Startups',
  'Fashion', 'Basketball', 'Finance', 'Marketing',
];

export const PERSONALITY_TAGS = [
  'Chill', 'Thoughtful', 'Funny', 'Ambitious', 'Introvert',
  'Extrovert', 'Creative', 'Curious', 'Calm', 'Energetic',
];

export const DATING_GOALS = [
  'Serious dating', 'Slow connection', 'Coffee dates',
  'Study partner', 'Weekend hangouts', 'New friends first',
];

export const PREFERRED_VIBES = [
  'Deep talks', 'Same campus', 'Same major', 'Easy-going',
  'Creative energy', 'Career-minded', 'Quiet dates', 'Active plans',
];

export const SAMPLE_PROFILE = {
  age: 21,
  major: 'SE' as const,
  campus: 'HCM' as const,
  bio: 'Mình thích những cuộc trò chuyện nhẹ nhàng, cafe cuối tuần và các project công nghệ có ích.',
  interests: ['Coding', 'Coffee', 'Music', 'Startups'],
  personalityTags: ['Chill', 'Thoughtful', 'Curious'],
  datingGoals: ['Slow connection', 'Coffee dates', 'New friends first'],
  preferredVibes: ['Deep talks', 'Easy-going', 'Same campus'],
  profileText: {
    bio: 'Mình thích những cuộc trò chuyện nhẹ nhàng, cafe cuối tuần và các project công nghệ có ích.',
    weekendStyle: 'Đi cafe, nghe nhạc, hoặc làm side project nếu có hứng.',
    conversationStyle: 'Mình thích nói chuyện chậm rãi, thật và có chiều sâu.',
    memorableThing: 'Muốn người khác nhớ mình là người dễ nói chuyện và biết lắng nghe.',
    relationshipIntent: 'Muốn bắt đầu từ bạn bè thoải mái rồi xem vibe có hợp không.',
  },
};

export function normalizeProfileText(user: Partial<User>): NonNullable<User['profileText']> {
  return {
    bio: user.profileText?.bio ?? user.bio ?? '',
    weekendStyle: user.profileText?.weekendStyle ?? '',
    conversationStyle: user.profileText?.conversationStyle ?? '',
    memorableThing: user.profileText?.memorableThing ?? '',
    relationshipIntent: user.profileText?.relationshipIntent ?? '',
  };
}

export function profileSignalCount(user: Partial<User>): number {
  const profileText = normalizeProfileText(user);
  return [
    profileText.bio,
    profileText.weekendStyle,
    profileText.conversationStyle,
    profileText.memorableThing,
    profileText.relationshipIntent,
  ].filter(value => value.trim().length > 0).length;
}

export function calculateProfileCompleteness(user: Partial<User>): number {
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

export type ProfileRequirementId =
  | 'name'
  | 'age'
  | 'campus'
  | 'major'
  | 'interests'
  | 'personalityTags'
  | 'datingGoals'
  | 'profileText';

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

export function getProfileReadiness(user: Partial<User>): ProfileReadiness {
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
  ];
  const completeness = calculateProfileCompleteness(user);
  const isComplete = completeness >= 75
    && requirements.find(requirement => requirement.id === 'age')?.isMet
    && requirements.find(requirement => requirement.id === 'interests')?.isMet
    && requirements.find(requirement => requirement.id === 'profileText')?.isMet;

  return {
    completeness,
    isComplete: Boolean(isComplete),
    requirements,
    missing: requirements.filter(requirement => !requirement.isMet),
    signalCount,
  };
}

export function isProfileCompleteForMatching(user: Partial<User>): boolean {
  return getProfileReadiness(user).isComplete;
}

export function stripUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripUndefinedFields(item)) as T;
  }

  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedFields(entryValue)])
  ) as T;
}

export function buildProfileSavePayload(
  user: User,
  updates: Partial<User>,
  onboardingSource: User['onboardingSource'] = 'manual'
): Partial<User> {
  const {
    id: _id,
    email: _email,
    aiSignals: _aiSignals,
    ...profileUpdates
  } = updates;
  const profileText = normalizeProfileText({ ...user, ...profileUpdates });
  const bio = profileText.bio;
  const next = {
    ...profileUpdates,
    bio,
    profileText,
    onboardingSource,
  };

  return stripUndefinedFields({
    ...next,
    profileCompleteness: calculateProfileCompleteness({ ...user, ...next }),
  });
}
