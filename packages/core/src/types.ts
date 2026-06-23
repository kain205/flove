export const CAMPUSES = ['HCM', 'Hanoi', 'Danang', 'Cantho'] as const;
export const MAJORS = ['SE', 'AI', 'Biz', 'Design', 'Marketing'] as const;

export type Campus = (typeof CAMPUSES)[number];
export type Major = (typeof MAJORS)[number];

export interface ProfileText {
  bio: string;
  weekendStyle?: string;
  conversationStyle?: string;
  memorableThing?: string;
  relationshipIntent?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  age: number;
  major: Major;
  campus: Campus;
  avatarUrl: string;
  bio: string;
  interests: string[];
  personalityTags: string[];
  datingGoals: string[];
  preferredVibes: string[];
  profileText: ProfileText;
  profileCompleteness: number;
  onboardingSource: 'manual' | 'sample_autofill';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PublicProfile {
  id: string;
  name: string;
  age: number;
  major: Major;
  campus: Campus;
  avatarUrl: string;
  bio: string;
  interests: string[];
  personalityTags: string[];
  datingGoals: string[];
  preferredVibes: string[];
  profileText: ProfileText;
  profileCompleteness: number;
}

export interface PreferenceProfile {
  id: string;
  userId: string;
  summary: string;
  hardFilters: string[];
  softPreferences: string[];
  feedbackSummary: string[];
  updatedAt: Date;
}

export type CuratedMatchStatus = 'pending' | 'accepted' | 'declined' | 'skipped' | 'reported' | 'matched';
export type MatchFeedbackDecision = 'accepted' | 'declined' | 'skipped' | 'reported';

export interface CuratedMatch {
  id: string;
  batchId: string;
  userId: string;
  candidateId: string;
  candidate: PublicProfile;
  pairKey: string;
  aiReason: string;
  compatibilityLabel: string;
  compatibilityScore: number;
  status: CuratedMatchStatus;
  feedbackTags: string[];
  feedbackNote?: string;
  createdAt: Date;
  decidedAt?: Date;
}

export interface DailyMatchBatch {
  id: string;
  userId: string;
  date: string;
  matches: CuratedMatch[];
  createdAt: Date;
}

export interface Conversation {
  id: string;
  matchId?: string;
  participantIds: string[];
  isAnonymous: boolean;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  isRead: boolean;
}
