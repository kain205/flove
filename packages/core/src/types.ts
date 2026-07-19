export const CAMPUSES = ['HCM', 'Hanoi', 'Danang', 'Cantho'] as const;
export const MAJORS = ['SE', 'AI', 'Biz', 'Design', 'Marketing'] as const;

export type Campus = (typeof CAMPUSES)[number];
export type Major = (typeof MAJORS)[number];

export const CAMPUS_LABELS_VI: Record<Campus, string> = {
  HCM: 'TP. Hồ Chí Minh',
  Hanoi: 'Hà Nội',
  Danang: 'Đà Nẵng',
  Cantho: 'Cần Thơ',
};

export const MAJOR_LABELS_VI: Record<Major, string> = {
  SE: 'Công nghệ phần mềm',
  AI: 'Trí tuệ nhân tạo',
  Biz: 'Kinh doanh',
  Design: 'Thiết kế',
  Marketing: 'Marketing',
};

export function campusLabelVi(campus: Campus): string {
  return CAMPUS_LABELS_VI[campus] ?? campus;
}

export function majorLabelVi(major: Major): string {
  return MAJOR_LABELS_VI[major] ?? major;
}

export interface ProfileText {
  bio: string;
  school?: string;
  majorLabel?: string;
  weekendStyle?: string;
  conversationStyle?: string;
  memorableThing?: string;
  relationshipIntent?: string;
}

export interface OnboardingAnswer {
  questionId: string;
  value: string | string[];
  answeredAt: string;
}

export interface OnboardingSignals {
  intents: string[];
  values: Record<string, number>;
  interests: string[];
  lifestyle: Record<string, number>;
  communication: Record<string, number>;
  personality: Record<string, number>;
  dealbreakers: string[];
  preferredPartnerTraits: string[];
  vibeTags: string[];
  confidence: number;
  version: 'onboarding_v1';
  embeddings?: {
    interests?: number[];
    values?: number[];
    goals?: number[];
    communication?: number[];
    personality?: number[];
    preferredPartner?: number[];
  };
}

export interface ProfileAiSignals {
  onboarding?: {
    rawAnswers: OnboardingAnswer[];
    extractedTraits: OnboardingSignals;
    completedAt?: string;
  };
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
  aiSignals?: ProfileAiSignals;
  // Notebook AI onboarding fields (optional for backward compatibility).
  gender?: Gender;
  genderText?: string;
  lookingForGender?: string[];
  heightCm?: number | null;
  agePref?: { min?: number | null; max?: number | null };
  appearancePreference?: AppearancePreference;
  dealbreakers?: Dealbreaker[];
  aiProfileAnalysis?: AIProfileAnalysis | null;
  profileConfirmed?: boolean;
  /** Canonical onboarding answers persisted by onboarding v2. */
  onboardingAnswers?: OnboardingAnswerInput[];
  onboardingVersion?: number;
  profileRevision?: number;
  embeddingRevision?: number | null;
  embeddingStatus?: EmbeddingStatus;
  profileUpgradeRequired?: boolean;
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
  gender?: Gender;
  heightCm?: number | null;
}

export interface PreferenceProfile {
  id: string;
  userId: string;
  summary: string;
  hardFilters: string[];
  softPreferences: string[];
  softAvoidances: string[];
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
  suggestedOpener?: string;
  compatibilityLabel: string;
  compatibilityScore: number;
  status: CuratedMatchStatus;
  feedbackTags: string[];
  feedbackNote?: string;
  createdAt: Date;
  decidedAt?: Date;
}

/** A fully revealed recommendation. Only this shape may be acted on. */
export interface RevealedDailyPick extends CuratedMatch {
  kind: 'revealed';
}

/**
 * Deliberately identity-free preview returned while a batch is locked. Keep
 * this contract small: adding profile or internal match fields is a privacy
 * boundary change, not a presentation change.
 */
export interface LockedDailyPick {
  kind: 'locked';
  previewId: string;
  compatibilityLabel: string;
  compatibilityScore: number;
}

export type DailyPick = RevealedDailyPick | LockedDailyPick;
export type AiPickAccessMode = 'open' | 'stub';
export type AiPickBatchAccessState = 'teaser' | 'locked' | 'unlocked';

export interface DailyMatchBatch {
  id: string;
  userId: string;
  date: string;
  matches: DailyPick[];
  mode: AiPickAccessMode;
  state: AiPickBatchAccessState;
  priceVnd: number;
  lockedCount: number;
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

// --- Notebook AI onboarding -------------------------------------------------

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_show';

/** Discovery tokens stored in `looking_for_gender`. */
export type LookingForToken = 'male' | 'female' | 'everyone' | 'depends';

export type PreferenceImportance = 'none' | 'soft' | 'medium' | 'hard';
export type DealbreakerSeverity = 'soft' | 'medium' | 'hard';

export interface Dealbreaker {
  trait: string;
  severity: DealbreakerSeverity;
  reason?: string;
}

export interface HeightPreference {
  importance: PreferenceImportance;
  minHeightCm?: number;
  maxHeightCm?: number;
  prefersTallerThanSelf?: boolean;
  prefersShorterThanSelf?: boolean;
}

export interface AppearancePreference {
  importance: PreferenceImportance;
  preferredStyleTags: string[];
  preferredAppearanceVibeTags: string[];
  heightPreference: HeightPreference;
  physicalDealbreakers: Dealbreaker[];
}

/** Numeric communication style signals, each roughly 0..1. */
export interface CommunicationStyle {
  deepTalk: number;
  humor: number;
  textingFrequency: number;
  directness: number;
  slowBurn: number;
  initiatesConversation: number;
  prefersInPersonSoon: number;
  emotionalExpression: number;
}

export interface MatchingSignals {
  intents: string[];
  intentClarity: number;
  seriousnessLevel: number;
  relationshipPace: string;
  selfTraits: string[];
  interests: string[];
  vibeTags: string[];
  values: Record<string, number>;
  personality: Record<string, number>;
  lifestyle: Record<string, number>;
  preferredPartnerTraits: string[];
  appearancePreference: AppearancePreference;
  communication: CommunicationStyle;
  dealbreakers: Dealbreaker[];
  confidence: number;
}

export interface AIProfilePublicFields {
  displayName: string;
  age: number;
  gender?: string;
  school: string;
  major: string;
  heightCm?: number;
  bio: string;
  vibeSummary: string;
  conversationHooks: string[];
}

export interface AIProfileReview {
  selfSummary: string;
  seekingSummary: string;
  idealMatchSummary: string;
  avoidSummary: string;
  suggestedBio: string;
}

/** Full structured output of the one-shot onboarding LLM analysis. */
export interface AIProfileAnalysis {
  publicProfile: AIProfilePublicFields;
  matchingSignals: MatchingSignals;
  aiReview: AIProfileReview;
}

// --- Onboarding v2 ---------------------------------------------------------

export const ONBOARDING_VERSION = 2 as const;

export interface OnboardingAnswerInput {
  questionId: string;
  value: string | string[];
}

export interface OnboardingBasicInput {
  name?: string;
  age?: number;
  gender?: string;
  genderText?: string;
  lookingForGender?: string[];
  heightCm?: number | null;
  school?: string;
  majorLabel?: string;
  major?: string;
  campus?: string;
  avatarUrl?: string;
  agePrefMin?: number | null;
  agePrefMax?: number | null;
}

/** Server-persisted draft. The opaque UI fields are represented by basic + raw answers. */
export interface OnboardingDraftV2 {
  version: typeof ONBOARDING_VERSION;
  step: number;
  basic: OnboardingBasicInput;
  answers: OnboardingAnswerInput[];
}

export interface OnboardingReviewEdits {
  selfSummary: string;
  seekingSummary: string;
  idealMatchSummary: string;
  avoidSummary: string;
  suggestedBio: string;
}

export interface PersistedOnboardingDraft {
  draft: OnboardingDraftV2;
  draftRevision: number;
  analysis: AIProfileAnalysis | null;
  analysisRevision: number | null;
  updatedAt: Date;
}

export type EmbeddingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
  };
  retryAfterMs?: number;
}

/** Default empty preference object — convenient for building partial analyses. */
export const EMPTY_APPEARANCE_PREFERENCE: AppearancePreference = {
  importance: 'none',
  preferredStyleTags: [],
  preferredAppearanceVibeTags: [],
  heightPreference: { importance: 'none' },
  physicalDealbreakers: [],
};
