export const REPORT_REASONS = [
  'harassment',
  'fake_profile',
  'inappropriate_content',
  'spam',
  'underage',
  'other',
] as const;

export const USER_SAFETY_ACTIONS = [
  'warning',
  'temporary_restriction',
  'shadow_review',
  'suspension',
  'ban',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];
export type UserSafetyAction = (typeof USER_SAFETY_ACTIONS)[number];
