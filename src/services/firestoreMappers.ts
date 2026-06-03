import type { User as FirebaseUser } from 'firebase/auth';
import type { CuratedMatch, Profile, User, UserProfile } from '@/types';
import { normalizeProfileText } from './profileService';

export type FirestoreRecord = Record<string, unknown>;

export type TimestampLike = {
  toDate?: () => Date;
};

export type CuratedMatchDoc = Omit<CuratedMatch, 'candidate' | 'createdAt' | 'decidedAt'> & {
  candidateSnapshot: Profile;
  createdAt?: TimestampLike;
  decidedAt?: TimestampLike;
};

export function toDate(value: unknown, fallback = new Date()): Date {
  return (value as TimestampLike | undefined)?.toDate?.() ?? fallback;
}

function mapAiSignals(data: FirestoreRecord): User['aiSignals'] {
  const aiSignals = data.aiSignals as (User['aiSignals'] & { lastProcessedAt?: TimestampLike | Date }) | undefined;
  if (!aiSignals) return undefined;

  return {
    ...aiSignals,
    lastProcessedAt: aiSignals.lastProcessedAt instanceof Date
      ? aiSignals.lastProcessedAt
      : aiSignals.lastProcessedAt?.toDate?.(),
  };
}

export function profileFromFirestore(id: string, data: FirestoreRecord): Profile {
  return {
    id,
    email: (data.email as string) ?? '',
    name: (data.name as string) ?? 'FPT Student',
    age: (data.age as number) ?? 0,
    major: (data.major as Profile['major']) ?? 'SE',
    campus: (data.campus as Profile['campus']) ?? 'HCM',
    avatar: (data.avatar as string) ?? '',
    bio: (data.bio as string) ?? '',
    interests: (data.interests as string[]) ?? [],
    personalityTags: (data.personalityTags as string[]) ?? [],
    datingGoals: (data.datingGoals as string[]) ?? [],
    preferredVibes: (data.preferredVibes as string[]) ?? [],
    profileText: normalizeProfileText({
      bio: (data.bio as string) ?? '',
      profileText: data.profileText as Profile['profileText'],
    }),
    profileCompleteness: (data.profileCompleteness as number) ?? 0,
    onboardingSource: data.onboardingSource as Profile['onboardingSource'],
    aiSignals: mapAiSignals(data),
    isOnline: (data.isOnline as boolean) ?? false,
  };
}

export function userProfileFromFirestore(id: string, data: FirestoreRecord): UserProfile {
  return {
    ...profileFromFirestore(id, data),
    createdAt: toDate(data.createdAt),
  };
}

export function appUserFromFirebase(fbUser: FirebaseUser, profile: Partial<UserProfile>): User {
  const profileText = normalizeProfileText(profile);

  return {
    id: fbUser.uid,
    email: fbUser.email ?? '',
    name: profile.name ?? fbUser.displayName ?? fbUser.email?.split('@')[0] ?? '',
    age: profile.age ?? 0,
    major: profile.major ?? 'SE',
    campus: profile.campus ?? 'HCM',
    avatar: profile.avatar ?? fbUser.photoURL ?? '',
    bio: profile.bio ?? '',
    interests: profile.interests ?? [],
    personalityTags: profile.personalityTags ?? [],
    datingGoals: profile.datingGoals ?? [],
    preferredVibes: profile.preferredVibes ?? [],
    profileText,
    profileCompleteness: profile.profileCompleteness ?? 0,
    onboardingSource: profile.onboardingSource,
    aiSignals: profile.aiSignals,
  };
}

export function curatedMatchFromFirestore(id: string, data: CuratedMatchDoc): CuratedMatch {
  const candidate = profileFromFirestore(
    data.candidateId,
    data.candidateSnapshot as unknown as FirestoreRecord
  );

  return {
    id,
    batchId: data.batchId,
    userId: data.userId,
    candidateId: data.candidateId,
    candidate,
    pairKey: data.pairKey,
    aiReason: data.aiReason,
    compatibilityLabel: data.compatibilityLabel,
    compatibilityScore: data.compatibilityScore,
    status: data.status,
    feedbackTags: data.feedbackTags ?? [],
    feedbackNote: data.feedbackNote,
    createdAt: toDate(data.createdAt),
    decidedAt: data.decidedAt ? toDate(data.decidedAt) : undefined,
  };
}
