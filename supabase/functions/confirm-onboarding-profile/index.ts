import { createServiceClient, errorResponse, expectedUserFenceResponse, jsonObjectBody, jsonResponse, requireUser } from '../_shared/client.ts';
import { kickAiWorker } from '../_shared/ai-jobs.ts';
import { buildLegacyAiSignals, ensureLegacyDraft, LegacyOnboardingError } from '../_shared/onboarding-compat.ts';
import {
  applyReviewEditsToAnalysis,
  canonicalizeAnalysis,
  fallbackAnalysis,
  normalizeReviewEdits,
  onboardingDraftFromJson,
  validateOnboardingDraft,
} from '../_shared/analysis.ts';

function unique(items: unknown[], max: number): string[] {
  return Array.from(new Set(items.map(item => String(item).trim()).filter(Boolean))).slice(0, max);
}

function recordKeys(record: unknown): string[] {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
  return Object.entries(record).filter(([, value]) => Number(value) > 0).map(([key]) => key);
}

function positiveRevision(value: unknown): number | null {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null;
}

function ownedAvatarUrl(value: unknown, userId: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('storage_origin_unavailable');
  const avatar = new URL(raw);
  const project = new URL(supabaseUrl);
  const ownerPrefix = `/storage/v1/object/public/avatars/${userId}/`;
  if (
    avatar.origin !== project.origin
    || !avatar.pathname.startsWith(ownerPrefix)
    || avatar.username
    || avatar.password
    || avatar.search
    || avatar.hash
  ) {
    throw new Error('avatar_not_owned');
  }
  return avatar.toString();
}

function computeCompleteness(input: {
  name: string;
  age: number;
  interestsCount: number;
  personalityCount: number;
  goalsCount: number;
  hasBio: boolean;
  hasSignals: boolean;
}): number {
  const checks = [
    Boolean(input.name.trim()),
    input.age >= 17,
    true, // validated campus
    true, // validated major
    input.interestsCount >= 3,
    input.personalityCount >= 1,
    input.goalsCount >= 1,
    input.hasBio && input.hasSignals,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

Deno.serve(async req => {
  const startedAt = Date.now();
  const { client, user, requestId, response } = await requireUser(req);
  if (response) return response;

  const body = await jsonObjectBody(req);
  let draftRevision = positiveRevision(body.draftRevision);
  let analysisRevision = positiveRevision(body.analysisRevision);
  const hasRevisionField = body.draftRevision != null || body.analysisRevision != null;
  const fenceResponse = expectedUserFenceResponse(body, user!.id, requestId, hasRevisionField);
  if (fenceResponse) return fenceResponse;
  if (hasRevisionField && (!draftRevision || !analysisRevision)) {
    return errorResponse(requestId, 'invalid_request', 'draftRevision và analysisRevision phải đi cùng nhau.', 400);
  }
  const admin = createServiceClient();
  let row: any;
  let isLegacyRequest = false;
  if (draftRevision && analysisRevision) {
    const { data, error: draftError } = await admin
      .from('onboarding_drafts')
      .select('draft,draft_revision,analysis,analysis_revision')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (draftError) {
      console.error(JSON.stringify({ event: 'onboarding_confirm_draft_error', requestId, code: draftError.code }));
      return errorResponse(requestId, 'draft_unavailable', 'Không tải được bản nháp onboarding.', 503, true);
    }
    row = data;
  } else {
    isLegacyRequest = true;
    try {
      row = await ensureLegacyDraft({ body, userId: user!.id, userClient: client, admin });
    } catch (error) {
      if (error instanceof LegacyOnboardingError) {
        return errorResponse(requestId, error.code, error.message, error.status, error.retryable);
      }
      return errorResponse(requestId, 'draft_save_failed', 'Không lưu được bản nháp onboarding.', 503, true);
    }
    draftRevision = positiveRevision(row.draft_revision);
    analysisRevision = positiveRevision(row.analysis_revision);
  }
  if (!row) return errorResponse(requestId, 'draft_not_found', 'Chưa có bản nháp onboarding.', 404);
  if (!draftRevision) return errorResponse(requestId, 'invalid_draft', 'Bản nháp onboarding không có revision hợp lệ.', 422);

  const draft = onboardingDraftFromJson(row.draft);
  if (!draft) return errorResponse(requestId, 'invalid_draft', 'Bản nháp onboarding không hợp lệ.', 422);
  const validationError = validateOnboardingDraft(draft);
  if (validationError) return errorResponse(requestId, 'incomplete_draft', validationError, 422);

  // Old confirm clients may not have called analyze first. Create a deterministic
  // server-owned analysis; never consume body.analysis.matchingSignals.
  if (isLegacyRequest && (!row.analysis || analysisRevision !== draftRevision)) {
    const fallback = canonicalizeAnalysis(fallbackAnalysis(draft.answers, draft.basic), draft.answers, draft.basic);
    const { data: savedValue, error: saveError } = await admin.rpc('save_onboarding_analysis', {
      p_user_id: user!.id,
      p_draft_revision: draftRevision,
      p_analysis: fallback,
      p_analysis_source: 'legacy-confirm-fallback',
    });
    if (saveError) {
      const stale = saveError.code === '40001' || saveError.message.toLowerCase().includes('stale');
      return errorResponse(
        requestId,
        stale ? 'stale_draft' : 'analysis_save_failed',
        stale ? 'Bản nháp đã thay đổi. Vui lòng thử lại.' : 'Không lưu được kết quả phân tích.',
        stale ? 409 : 503,
        !stale,
      );
    }
    const saved = Array.isArray(savedValue) ? savedValue[0] : savedValue;
    row.analysis = saved?.analysis;
    row.analysis_revision = saved?.analysis_revision;
    analysisRevision = positiveRevision(saved?.analysis_revision);
  }
  if (!analysisRevision) return errorResponse(requestId, 'stale_analysis', 'Chưa có kết quả phân tích hợp lệ.', 409);
  if (Number(row.draft_revision) !== draftRevision) {
    return errorResponse(requestId, 'stale_draft', 'Bản nháp đã thay đổi. Vui lòng phân tích lại.', 409);
  }
  if (Number(row.analysis_revision) !== analysisRevision || analysisRevision !== draftRevision || !row.analysis) {
    return errorResponse(requestId, 'stale_analysis', 'Kết quả phân tích đã cũ. Vui lòng phân tích lại.', 409);
  }

  const legacyAnalysis = body.analysis && typeof body.analysis === 'object' && !Array.isArray(body.analysis)
    ? body.analysis as Record<string, unknown>
    : {};
  const reviewEdits = normalizeReviewEdits(isLegacyRequest ? legacyAnalysis.aiReview : body.reviewEdits);
  const analysis = applyReviewEditsToAnalysis(row.analysis, reviewEdits, draft.answers, draft.basic);

  const basic = draft.basic;
  const signals = analysis.matchingSignals;
  const publicProfile = analysis.publicProfile;
  const interests = unique([...(signals.interests ?? []), ...(signals.vibeTags ?? []), ...(signals.selfTraits ?? [])], 10);
  for (const compatibilityTag of ['Authentic conversations', 'Meaningful connections', 'Student life']) {
    if (interests.length >= 3) break;
    interests.push(compatibilityTag);
  }
  const personalityTags = unique([...(signals.selfTraits ?? []), ...recordKeys(signals.personality)], 10);
  const datingGoals = unique(signals.intents ?? [], 6);
  const preferredVibes = unique([...(signals.preferredPartnerTraits ?? []), ...recordKeys(signals.lifestyle)], 10);
  const bio = String(publicProfile.bio ?? analysis.aiReview.suggestedBio ?? '').trim().slice(0, 500);
  const age = Number.parseInt(String(basic.age ?? publicProfile.age ?? 0), 10) || 0;
  const completeness = computeCompleteness({
    name: String(basic.name ?? '').trim(),
    age,
    interestsCount: interests.length,
    personalityCount: personalityTags.length,
    goalsCount: datingGoals.length,
    hasBio: bio.length > 0,
    hasSignals: (signals.confidence ?? 0) > 0 || datingGoals.length > 0,
  });
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('profile_confirmed_at')
    .eq('id', user!.id)
    .maybeSingle();

  let avatarUrl = '';
  try {
    avatarUrl = ownedAvatarUrl(basic.avatarUrl, user!.id);
  } catch {
    return errorResponse(
      requestId,
      'invalid_avatar',
      'Ảnh đại diện phải được tải lên vùng lưu trữ F-Love của chính bạn.',
      400,
    );
  }

  const payload: Record<string, unknown> = {
    id: user!.id,
    email: user!.email ?? '',
    name: String(basic.name ?? '').trim(),
    age,
    major: basic.major ?? 'SE',
    campus: basic.campus ?? 'HCM',
    gender: basic.gender ?? 'prefer_not_to_show',
    gender_text: basic.gender === 'other' ? basic.genderText || null : null,
    looking_for_gender: basic.lookingForGender ?? [],
    height_cm: basic.heightCm ?? null,
    age_pref_min: basic.agePrefMin ?? null,
    age_pref_max: basic.agePrefMax ?? null,
    avatar_url: avatarUrl,
    bio,
    interests,
    personality_tags: personalityTags,
    dating_goals: datingGoals,
    preferred_vibes: preferredVibes,
    profile_text: {
      bio,
      school: String(basic.school ?? publicProfile.school ?? '').trim(),
      majorLabel: String(basic.majorLabel ?? publicProfile.major ?? '').trim(),
      weekendStyle: String(publicProfile.vibeSummary ?? '').trim(),
      conversationStyle: '',
      memorableThing: '',
      relationshipIntent: datingGoals.join(', '),
    },
    appearance_preference: signals.appearancePreference ?? {},
    dealbreakers: signals.dealbreakers ?? [],
    ai_profile_analysis: analysis,
    ai_signals: buildLegacyAiSignals(draft, analysis),
    onboarding_answers: draft.answers,
    onboarding_version: 2,
    profile_completeness: completeness,
    onboarding_source: 'manual',
    profile_confirmed: true,
    profile_confirmed_at: existingProfile?.profile_confirmed_at ?? new Date().toISOString(),
  };

  // The RPC locks the source draft, verifies both revisions again, persists the
  // profile and durably enqueues the embedding job in the same transaction.
  const { data: savedValue, error: profileError } = await admin.rpc('confirm_onboarding_profile_atomic', {
    p_user_id: user!.id,
    p_draft_revision: draftRevision,
    p_analysis_revision: analysisRevision,
    p_profile: payload,
  });
  const savedProfile = Array.isArray(savedValue) ? savedValue[0] : savedValue;
  if (profileError || !savedProfile) {
    console.error(JSON.stringify({ event: 'onboarding_confirm_profile_error', requestId, code: profileError?.code }));
    const stale = profileError?.code === '40001' || profileError?.message?.toLowerCase().includes('revision');
    return errorResponse(
      requestId,
      stale ? 'stale_analysis' : 'profile_save_failed',
      stale ? 'Bản nháp hoặc kết quả phân tích đã thay đổi. Vui lòng phân tích lại.' : 'Không lưu được hồ sơ.',
      stale ? 409 : 503,
      !stale,
    );
  }

  const profileRevision = positiveRevision(savedProfile.profile_revision) ?? 1;
  const needsEmbedding = Number(savedProfile.embedding_revision ?? 0) < profileRevision
    || savedProfile.embedding_status !== 'ready';
  const embeddingStatus = String(savedProfile.embedding_status ?? 'pending');
  if (needsEmbedding) kickAiWorker();

  console.log(JSON.stringify({
    event: 'onboarding_confirm_completed',
    requestId,
    userId: user!.id,
    draftRevision,
    profileRevision,
    profileCompleteness: completeness,
    embeddingStatus,
    durationMs: Date.now() - startedAt,
  }));
  return jsonResponse({
    ok: true,
    profileCompleteness: completeness,
    profileRevision,
    embeddingStatus,
    profile: savedProfile,
  }, 200, requestId);
});
