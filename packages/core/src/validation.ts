import {
  ONBOARDING_VERSION,
  type OnboardingAnswerInput,
  type OnboardingBasicInput,
  type OnboardingDraftV2,
  type OnboardingReviewEdits,
} from './types';

// F-Love accepts any student/personal email; only a plausible address is required.
export const SIGNUP_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidSignupEmail(email: string): boolean {
  return SIGNUP_EMAIL_REGEX.test(email.trim());
}

export function assertValidSignupEmail(email: string): void {
  if (!isValidSignupEmail(email)) {
    throw new Error('Vui lòng nhập một địa chỉ email hợp lệ');
  }
}

/** @deprecated FPT-only signup was removed; kept as an alias for old imports. */
export const isFptEmail = isValidSignupEmail;
/** @deprecated FPT-only signup was removed; kept as an alias for old imports. */
export const assertFptEmail = assertValidSignupEmail;

const MAX_ANSWER_LENGTH = 4_000;
const MAX_REVIEW_LENGTH = 1_000;
const MAX_ANSWERS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normalizeOnboardingAnswers(value: unknown): OnboardingAnswerInput[] {
  const input = isRecord(value) && Array.isArray(value.answers) ? value.answers : value;
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_ANSWERS).flatMap(item => {
    if (!isRecord(item)) return [];
    const questionId = cleanText(item.questionId, 100);
    if (!questionId) return [];
    const answerValue = Array.isArray(item.value)
      ? item.value.slice(0, 30).map(entry => cleanText(entry, MAX_ANSWER_LENGTH)).filter(Boolean)
      : cleanText(item.value, MAX_ANSWER_LENGTH);
    return [{ questionId, value: answerValue }];
  });
}

export function normalizeOnboardingBasic(value: unknown): OnboardingBasicInput {
  const input = isRecord(value) ? value : {};
  const numberOrNull = (item: unknown) => typeof item === 'number' && Number.isFinite(item) ? item : null;
  return {
    name: cleanText(input.name, 120),
    age: numberOrNull(input.age) ?? undefined,
    gender: cleanText(input.gender, 60),
    genderText: cleanText(input.genderText, 120),
    lookingForGender: Array.isArray(input.lookingForGender)
      ? input.lookingForGender.slice(0, 10).map(item => cleanText(item, 60)).filter(Boolean)
      : [],
    heightCm: numberOrNull(input.heightCm),
    school: cleanText(input.school, 200),
    majorLabel: cleanText(input.majorLabel, 200),
    major: cleanText(input.major, 40),
    campus: cleanText(input.campus, 40),
    avatarUrl: cleanText(input.avatarUrl, 2_048),
    agePrefMin: numberOrNull(input.agePrefMin),
    agePrefMax: numberOrNull(input.agePrefMax),
  };
}

export function normalizeOnboardingDraft(value: unknown): OnboardingDraftV2 | null {
  if (!isRecord(value) || value.version !== ONBOARDING_VERSION) return null;
  return {
    version: ONBOARDING_VERSION,
    step: Math.max(0, Math.min(6, Math.trunc(Number(value.step) || 0))),
    basic: normalizeOnboardingBasic(value.basic),
    answers: normalizeOnboardingAnswers(value.answers),
  };
}

export function normalizeOnboardingReviewEdits(value: unknown): OnboardingReviewEdits {
  const input = isRecord(value) ? value : {};
  return {
    selfSummary: cleanText(input.selfSummary, MAX_REVIEW_LENGTH),
    seekingSummary: cleanText(input.seekingSummary, MAX_REVIEW_LENGTH),
    idealMatchSummary: cleanText(input.idealMatchSummary, MAX_REVIEW_LENGTH),
    avoidSummary: cleanText(input.avoidSummary, MAX_REVIEW_LENGTH),
    suggestedBio: cleanText(input.suggestedBio, 500),
  };
}
