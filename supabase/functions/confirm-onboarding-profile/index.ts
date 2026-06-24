import { createServiceClient, jsonResponse, requireUser } from '../_shared/client.ts';
import { DEFAULT_EMBEDDING_MODEL, createEmbedding } from '../_shared/openai.ts';
import { buildVectorTexts, type RawAnswer } from '../_shared/analysis.ts';

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map(item => String(item).trim()).filter(Boolean)));
}

function recordKeys(record: Record<string, number> = {}): string[] {
  return Object.keys(record).filter(key => (record[key] ?? 0) > 0);
}

/** pgvector accepts its text representation; null when the embedding is missing. */
function formatVector(values: number[] | null | undefined): string | null {
  return values && values.length > 0 ? `[${values.join(',')}]` : null;
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
    true, // campus always set
    true, // major always set
    input.interestsCount >= 3,
    input.personalityCount >= 1,
    input.goalsCount >= 1,
    input.hasBio && input.hasSignals,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// Persists the confirmed profile: derives display fields from the analysis, generates the 5
// embeddings (text-embedding-3-small) server-side, and marks the profile confirmed so AI Picks
// unlocks. Embedding failures are non-fatal — vectors are stored null and matching degrades to
// signal-based scoring.
Deno.serve(async req => {
  const { user, response } = await requireUser(req);
  if (response) return response;
  const admin = createServiceClient();

  const body = await req.json().catch(() => ({}));
  const analysis = body.analysis ?? {};
  const basic = body.basic ?? {};
  const answers: RawAnswer[] = Array.isArray(body.answers) ? body.answers : [];

  const signals = analysis.matchingSignals ?? {};
  const publicProfile = analysis.publicProfile ?? {};

  const interests = unique([...(signals.interests ?? []), ...(signals.vibeTags ?? [])]).slice(0, 10);
  const personalityTags = unique([...(signals.selfTraits ?? []), ...recordKeys(signals.personality)]).slice(0, 10);
  const datingGoals = unique([...(signals.intents ?? [])]).slice(0, 6);
  const preferredVibes = unique([...(signals.preferredPartnerTraits ?? []), ...recordKeys(signals.lifestyle)]).slice(0, 10);

  const bio = String(publicProfile.bio ?? analysis.aiReview?.suggestedBio ?? '').trim();
  const profileText = {
    bio,
    school: String(basic.school ?? publicProfile.school ?? '').trim(),
    majorLabel: String(basic.majorLabel ?? publicProfile.major ?? '').trim(),
    weekendStyle: String(publicProfile.vibeSummary ?? '').trim(),
    conversationStyle: '',
    memorableThing: '',
    relationshipIntent: (signals.intents ?? []).join(', '),
  };

  // Embeddings (best-effort).
  const vectors: Record<string, number[] | null> = {
    self: null, need: null, preference: null, communication: null, lifestyle: null,
  };
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (apiKey) {
    const model = Deno.env.get('OPENAI_EMBEDDING_MODEL') ?? DEFAULT_EMBEDDING_MODEL;
    const texts = buildVectorTexts(answers, analysis);
    try {
      await Promise.all(
        Object.keys(vectors).map(async key => {
          vectors[key] = await createEmbedding({ apiKey, model, input: texts[key] ?? '' });
        }),
      );
    } catch (error) {
      console.error('Embedding generation failed; storing null vectors.', error);
    }
  }

  const age = Number.parseInt(String(basic.age ?? publicProfile.age ?? 0), 10) || 0;
  const completeness = computeCompleteness({
    name: String(basic.name ?? '').trim(),
    age,
    interestsCount: interests.length,
    personalityCount: personalityTags.length,
    goalsCount: datingGoals.length,
    hasBio: bio.length > 0,
    hasSignals: (signals.confidence ?? 0) > 0 || (signals.intents ?? []).length > 0,
  });

  const payload: Record<string, unknown> = {
    id: user!.id,
    email: user!.email ?? '',
    name: String(basic.name ?? '').trim(),
    age,
    major: basic.major ?? 'SE',
    campus: basic.campus ?? 'HCM',
    gender: basic.gender ?? 'prefer_not_to_show',
    gender_text: basic.genderText ?? null,
    looking_for_gender: Array.isArray(basic.lookingForGender) ? basic.lookingForGender : [],
    height_cm: basic.heightCm ?? null,
    age_pref_min: basic.agePrefMin ?? null,
    age_pref_max: basic.agePrefMax ?? null,
    avatar_url: String(basic.avatarUrl ?? '').trim(),
    bio,
    interests,
    personality_tags: personalityTags,
    dating_goals: datingGoals,
    preferred_vibes: preferredVibes,
    profile_text: profileText,
    appearance_preference: signals.appearancePreference ?? {},
    dealbreakers: signals.dealbreakers ?? [],
    ai_profile_analysis: analysis,
    profile_completeness: completeness,
    onboarding_source: 'manual',
    profile_confirmed: true,
    profile_confirmed_at: new Date().toISOString(),
    self_vector: formatVector(vectors.self),
    need_vector: formatVector(vectors.need),
    preference_vector: formatVector(vectors.preference),
    communication_vector: formatVector(vectors.communication),
    lifestyle_vector: formatVector(vectors.lifestyle),
  };

  const { error } = await admin.from('profiles').upsert(payload);
  if (error) return jsonResponse({ error: error.message }, 400);

  return jsonResponse({ ok: true, profileCompleteness: completeness, embedded: Boolean(vectors.self) });
});
