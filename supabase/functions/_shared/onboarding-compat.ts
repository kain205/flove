import {
  onboardingDraftFromJson,
  validateOnboardingDraft,
  type OnboardingDraftPayload,
} from './analysis.ts';

export interface PersistedOnboardingDraftRow {
  draft: unknown;
  draft_revision: number;
  analysis: unknown | null;
  analysis_revision: number | null;
  analysis_source?: string | null;
}

export class LegacyOnboardingError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'LegacyOnboardingError';
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Converts only legacy raw answers/basic into v2; structured client analysis is ignored. */
export function legacyDraftFromBody(value: unknown): OnboardingDraftPayload | null {
  const body = record(value);
  if (!body || !Array.isArray(body.answers) || !record(body.basic)) return null;
  const answers = body.answers.map(item => record(item) ? { ...item } : item);
  const hasBoundaryFlag = answers.some(item => record(item)?.questionId === 'boundaries_unsure');
  const boundaryText = answers.find(item => record(item)?.questionId === 'boundaries_text');
  const rawBoundaryValue = record(boundaryText)?.value;
  // The released client represented “Mình chưa chắc” only as an empty
  // boundaries_text. That UI could not submit an empty value otherwise.
  if (!hasBoundaryFlag && (rawBoundaryValue == null || String(rawBoundaryValue).trim() === '')) {
    answers.push({ questionId: 'boundaries_unsure', value: 'true' });
  }
  return onboardingDraftFromJson({
    version: 2,
    step: 6,
    basic: body.basic,
    answers,
  });
}

export function sameCanonicalDraft(left: unknown, right: OnboardingDraftPayload): boolean {
  const normalized = onboardingDraftFromJson(left);
  return Boolean(normalized && JSON.stringify(normalized) === JSON.stringify(right));
}

/** Compatibility projection for the previous binary's ai_signals route guard. */
export function buildLegacyAiSignals(draft: OnboardingDraftPayload, analysis: any) {
  const completedAt = new Date().toISOString();
  const answer = (id: string) => draft.answers.find(item => item.questionId === id)?.value;
  const signals = analysis?.matchingSignals ?? {};
  const selfText = String(answer('self_text') ?? '');
  const rawAnswers = [
    ...draft.answers.map(item => ({ ...item, answeredAt: completedAt })),
    { questionId: 'intent', value: answer('need_chips') ?? signals.intents ?? [], answeredAt: completedAt },
    { questionId: 'vibe', value: selfText, answeredAt: completedAt },
    { questionId: 'self_description', value: selfText, answeredAt: completedAt },
  ];
  return {
    onboarding: {
      rawAnswers,
      extractedTraits: {
        intents: signals.intents ?? [],
        values: signals.values ?? {},
        interests: signals.interests ?? [],
        lifestyle: signals.lifestyle ?? {},
        communication: signals.communication ?? {},
        personality: signals.personality ?? {},
        dealbreakers: (signals.dealbreakers ?? [])
          .map((item: any) => typeof item === 'string' ? item : item?.trait)
          .filter(Boolean),
        preferredPartnerTraits: signals.preferredPartnerTraits ?? [],
        vibeTags: signals.vibeTags ?? [],
        confidence: signals.confidence ?? 0,
        version: 'onboarding_v1',
        embeddings: {},
      },
      completedAt,
    },
  };
}

async function loadDraft(admin: any, userId: string): Promise<PersistedOnboardingDraftRow | null> {
  const { data, error } = await admin
    .from('onboarding_drafts')
    .select('draft,draft_revision,analysis,analysis_revision,analysis_source')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new LegacyOnboardingError('draft_unavailable', 'Không tải được bản nháp onboarding.', 503, true);
  }
  return data as PersistedOnboardingDraftRow | null;
}

/**
 * One-release adapter for old clients. It persists raw input through the same
 * owner-scoped CAS RPC as v2, and reuses an identical concurrent write safely.
 */
export async function ensureLegacyDraft(options: {
  body: unknown;
  userId: string;
  userClient: any;
  admin: any;
}): Promise<PersistedOnboardingDraftRow> {
  const draft = legacyDraftFromBody(options.body);
  if (!draft) {
    throw new LegacyOnboardingError('invalid_request', 'answers và basic là bắt buộc với client cũ.', 400);
  }
  const validationError = validateOnboardingDraft(draft);
  if (validationError) throw new LegacyOnboardingError('incomplete_draft', validationError, 422);

  const current = await loadDraft(options.admin, options.userId);
  if (current && sameCanonicalDraft(current.draft, draft)) return current;

  const { data, error } = await options.userClient.rpc('save_onboarding_draft', {
    p_draft: draft,
    p_expected_revision: current?.draft_revision ?? null,
    p_onboarding_version: 2,
    p_expected_user_id: options.userId,
  });
  if (!error) {
    const saved = (Array.isArray(data) ? data[0] : data) as PersistedOnboardingDraftRow | null;
    if (saved) return saved;
    throw new LegacyOnboardingError('draft_save_failed', 'Backend trả về bản nháp không hợp lệ.', 503, true);
  }

  // A concurrent legacy request may have saved this exact payload first.
  const latest = await loadDraft(options.admin, options.userId);
  if (latest && sameCanonicalDraft(latest.draft, draft)) return latest;
  const conflict = error.code === '40001' || String(error.message ?? '').toLowerCase().includes('revision');
  throw new LegacyOnboardingError(
    conflict ? 'stale_draft' : 'draft_save_failed',
    conflict ? 'Bản nháp đã thay đổi. Vui lòng thử lại.' : 'Không lưu được bản nháp onboarding.',
    conflict ? 409 : 503,
    !conflict,
  );
}
