// User & Profile Types
export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  major: 'SE' | 'AI' | 'Biz' | 'Design' | 'Marketing';
  campus: 'HCM' | 'Hanoi' | 'Danang' | 'Cantho';
  avatar: string;
  bio: string;
  interests: string[];
}

// Firestore user document
export interface UserProfile extends User {
  createdAt: Date;
}

export interface Profile extends User {
  distance?: string;
  isOnline?: boolean;
}

// Auth Types
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Match Types
export interface Match {
  id: string;
  matchedUser: User;
  matchedAt: Date;
  isRevealed: boolean;
}

// AI-curated matching
export type CuratedMatchStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'skipped'
  | 'reported'
  | 'matched';

export type MatchFeedbackDecision =
  | 'accepted'
  | 'declined'
  | 'skipped'
  | 'reported';

export interface PreferenceProfile {
  id: string;
  userId: string;
  summary: string;
  hardFilters: string[];
  softPreferences: string[];
  feedbackSummary: string[];
  updatedAt: Date;
}

export interface CuratedMatch {
  id: string;
  batchId: string;
  userId: string;
  candidateId: string;
  candidate: Profile;
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

export interface MatchFeedback {
  id: string;
  matchId: string;
  userId: string;
  candidateId: string;
  decision: MatchFeedbackDecision;
  tags: string[];
  note?: string;
  createdAt: Date;
}

export interface PreferenceChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

// Chat Types
export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: Message | null;
  isAnonymous: boolean;
  unreadCount: number;
  updatedAt: Date;
}

// Blind Date Types
export interface BlindDateSession {
  id: string;
  partnerId: string;
  partnerMaskedName: string;
  isRevealed: boolean;
  revealRequested: boolean;
  createdAt: Date;
}
