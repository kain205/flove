import { createServiceClient, jsonResponse, requireUser } from '../_shared/client.ts';
import { DEFAULT_CHAT_MODEL, clampScore, structuredResponse } from '../_shared/openai.ts';
import {
  compatibilityLabel,
  finalScore,
  passesHardFilters,
  toCompatibilityScore,
  type MatchProfile,
  type VectorSet,
} from '../_shared/scoring.ts';

const fallbackGenerator = 'edge-vector-matching-v2';
const candidatePoolLimit = 100;

function todayKey() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function pairKeyFor(a: string, b: string) {
  return [a, b].sort().join('_');
}

function campusLabel(campus: string) {
  const labels: Record<string, string> = {
    HCM: 'FPT University TP. Hồ Chí Minh',
    Hanoi: 'FPT University Hà Nội',
    Danang: 'FPT University Đà Nẵng',
    Cantho: 'FPT University Cần Thơ',
  };
  return labels[campus] ?? campus;
}

function parseVector(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toMatchProfile(row: any): MatchProfile {
  return {
    id: row.id,
    age: row.age,
    gender: row.gender,
    campus: row.campus,
    major: row.major,
    heightCm: row.height_cm ?? null,
    lookingForGender: row.looking_for_gender ?? [],
    agePrefMin: row.age_pref_min ?? null,
    agePrefMax: row.age_pref_max ?? null,
    appearancePreference: row.appearance_preference ?? row.ai_profile_analysis?.matchingSignals?.appearancePreference ?? null,
    dealbreakers: row.dealbreakers ?? [],
    signals: row.ai_profile_analysis?.matchingSignals ?? null,
    interests: row.interests ?? [],
  };
}

function toVectorSet(row: any): VectorSet {
  return {
    self: parseVector(row.self_vector),
    need: parseVector(row.need_vector),
    preference: parseVector(row.preference_vector),
    communication: parseVector(row.communication_vector),
    lifestyle: parseVector(row.lifestyle_vector),
  };
}

function publicSnapshot(row: any) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    major: row.major,
    campus: row.campus,
    gender: row.gender,
    height_cm: row.height_cm ?? null,
    avatar_url: row.avatar_url,
    bio: row.bio,
    interests: row.interests ?? [],
    personality_tags: row.personality_tags ?? [],
    dating_goals: row.dating_goals ?? [],
    preferred_vibes: row.preferred_vibes ?? [],
    profile_text: row.profile_text ?? { bio: row.bio ?? '' },
    profile_completeness: row.profile_completeness ?? 0,
  };
}

function profileForAi(row: any) {
  const review = row.ai_profile_analysis?.aiReview ?? {};
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    school: row.profile_text?.school ?? campusLabel(row.campus),
    major: row.profile_text?.majorLabel ?? row.major,
    bio: row.bio ?? '',
    interests: row.interests ?? [],
    personalityTags: row.personality_tags ?? [],
    datingGoals: row.dating_goals ?? [],
    preferredVibes: row.preferred_vibes ?? [],
    selfSummary: review.selfSummary ?? '',
    seekingSummary: review.seekingSummary ?? '',
  };
}

function buildReasonBullets(self: any, candidate: any) {
  const bullets: string[] = [];
  const selfInterests = new Set(self.interests ?? []);
  const shared = (candidate.interests ?? []).filter((i: string) => selfInterests.has(i));
  if (shared.length > 0) {
    bullets.push(`Hai bạn cùng quan tâm ${shared.slice(0, 3).join(', ')}, nên có điểm bắt chuyện tự nhiên.`);
  }
  if (self.campus === candidate.campus) {
    bullets.push(`Cùng học tại ${campusLabel(candidate.campus)}, dễ giữ nhịp gặp gỡ và hiểu bối cảnh của nhau.`);
  }
  const sharedGoals = (candidate.dating_goals ?? []).filter((goal: string) => (self.dating_goals ?? []).includes(goal));
  if (sharedGoals.length > 0) {
    bullets.push(`Cả hai có tín hiệu cùng hướng tới ${sharedGoals.slice(0, 2).join(' và ')}.`);
  }
  if ((candidate.preferred_vibes ?? []).length > 0) {
    bullets.push(`Vibe nổi bật của bạn ấy là ${(candidate.preferred_vibes ?? []).slice(0, 2).join(', ')}, hợp để khám phá nhẹ nhàng.`);
  }
  if (bullets.length === 0) {
    bullets.push(`Hồ sơ của ${candidate.name} tạo một góc nhìn mới nhưng vẫn hợp với gu hiện tại của bạn.`);
  }
  return bullets.slice(0, 3);
}

function buildReason(self: any, candidate: any) {
  return buildReasonBullets(self, candidate).map(reason => `✦ ${reason}`).join('\n');
}

const explanationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['matches'],
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidateId', 'compatibilityScore', 'compatibilityLabel', 'aiReason', 'insightBullets', 'suggestedOpener'],
        properties: {
          candidateId: { type: 'string' },
          compatibilityScore: { type: 'number' },
          compatibilityLabel: { type: 'string' },
          aiReason: { type: 'string' },
          insightBullets: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'string' },
          },
          suggestedOpener: { type: 'string' },
        },
      },
    },
  },
};

const explanationSystemPrompt = [
  'Bạn viết lời giải thích cho AI Picks của F-Love.',
  'Hệ thống đã chọn sẵn các ứng viên — bạn KHÔNG được chọn lại, chỉ viết lý do và câu mở lời.',
  'aiReason: 1 câu tiếng Việt ấm áp, nêu điểm hợp tổng quát, không nói phần trăm, không tiết lộ ghi chú riêng tư.',
  'insightBullets: đúng 3 câu ngắn, mỗi câu một insight cụ thể: giá trị/ý định, sở thích/bối cảnh, phong cách giao tiếp/vibe.',
  'Mỗi insightBullets dài tối đa 95 ký tự, viết tự nhiên, không dùng bullet marker, không nhắc dữ liệu nhạy cảm.',
  'suggestedOpener: 1 câu mở lời tự nhiên, lịch sự để người dùng nhắn cho ứng viên.',
  'Đây là gợi ý để khám phá, không phải match chính thức.',
].join(' ');

async function explainWithOpenAi(self: any, selected: Array<{ row: any; score: number }>) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey || selected.length === 0) return null;
  const model = Deno.env.get('OPENAI_MODEL') ?? DEFAULT_CHAT_MODEL;
  const byId = new Map(selected.map(item => [item.row.id, item]));

  const parsed = await structuredResponse({
    apiKey,
    model,
    system: explanationSystemPrompt,
    user: {
      self: profileForAi(self),
      matches: selected.map(({ row, score }) => ({ ...profileForAi(row), fallbackScore: score })),
    },
    schemaName: 'match_explanations',
    schema: explanationSchema,
  });

  const out = new Map<string, { score: number; label: string; reason: string; opener: string }>();
  for (const match of parsed.matches ?? []) {
    const item = byId.get(match.candidateId);
    if (!item) continue;
    const bullets = Array.isArray(match.insightBullets)
      ? match.insightBullets.map((text: unknown) => String(text ?? '').trim()).filter(Boolean).slice(0, 3)
      : [];
    const reason = bullets.length >= 2
      ? bullets.map((text: string) => `✦ ${text}`).join('\n')
      : match.aiReason?.trim() || buildReason(self, item.row);
    out.set(match.candidateId, {
      score: clampScore(match.compatibilityScore, item.score),
      label: match.compatibilityLabel?.trim() || compatibilityLabel(item.score),
      reason,
      opener: match.suggestedOpener?.trim() || '',
    });
  }
  return out;
}

Deno.serve(async req => {
  const { user, response } = await requireUser(req);
  if (response) return response;
  const admin = createServiceClient();

  const body = await req.json().catch(() => ({}));
  const date = typeof body.date === 'string' ? body.date : todayKey();
  const batchId = `${user!.id}_${date}`;

  const { data: existing } = await admin.from('daily_match_batches').select('id').eq('id', batchId).maybeSingle();
  if (existing) return jsonResponse({ ok: true, batchId, reused: true });

  const { data: self, error: selfError } = await admin.from('profiles').select('*').eq('id', user!.id).single();
  if (selfError) return jsonResponse({ error: 'Complete your profile before AI Picks.' }, 412);
  if (!self.profile_confirmed || (self.profile_completeness ?? 0) < 75) {
    return jsonResponse({ error: 'Confirm your onboarding profile before AI Picks.' }, 412);
  }

  const { data: candidates, error: candidatesError } = await admin.rpc('get_match_candidates', {
    p_user_id: user!.id,
    p_limit: candidatePoolLimit,
  });
  if (candidatesError) return jsonResponse({ error: candidatesError.message }, 400);

  const selfProfile = toMatchProfile(self);
  const selfVecs = toVectorSet(self);

  const ranked = (candidates ?? [])
    .map((row: any) => ({ row, profile: toMatchProfile(row), vecs: toVectorSet(row) }))
    .filter((item: any) => passesHardFilters(selfProfile, item.profile))
    .map((item: any) => ({
      row: item.row,
      score: toCompatibilityScore(finalScore(selfProfile, item.profile, selfVecs, item.vecs), self.campus === item.row.campus),
    }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5);

  let explanations: Map<string, { score: number; label: string; reason: string; opener: string }> | null = null;
  let generatedBy = fallbackGenerator;
  try {
    explanations = await explainWithOpenAi(self, ranked);
    if (explanations) generatedBy = `openai-${Deno.env.get('OPENAI_MODEL') ?? DEFAULT_CHAT_MODEL}`;
  } catch (error) {
    console.error('OpenAI explanation failed, using deterministic reasons.', error);
  }

  const selected = ranked.map(({ row, score }) => {
    const enriched = explanations?.get(row.id);
    return {
      row,
      score: enriched?.score ?? score,
      compatibilityLabel: enriched?.label ?? compatibilityLabel(score),
      aiReason: enriched?.reason ?? buildReason(self, row),
      suggestedOpener: enriched?.opener ?? null,
    };
  });

  const { error: batchError } = await admin.from('daily_match_batches').insert({
    id: batchId,
    user_id: user!.id,
    date,
    target_count: selected.length,
    generated_by: generatedBy,
  });
  if (batchError) return jsonResponse({ error: batchError.message }, 400);

  if (selected.length > 0) {
    const { error: matchesError } = await admin.from('curated_matches').insert(
      selected.map(({ row, score, aiReason, compatibilityLabel: label, suggestedOpener }) => ({
        id: `${batchId}_${row.id}`,
        batch_id: batchId,
        user_id: user!.id,
        candidate_id: row.id,
        candidate_snapshot: publicSnapshot(row),
        pair_key: pairKeyFor(user!.id, row.id),
        ai_reason: aiReason,
        suggested_opener: suggestedOpener,
        compatibility_label: label,
        compatibility_score: score,
      })),
    );
    if (matchesError) return jsonResponse({ error: matchesError.message }, 400);
  }

  return jsonResponse({ ok: true, batchId, generatedBy, matchCount: selected.length });
});
