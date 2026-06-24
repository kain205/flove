// AIProfileAnalysis: strict JSON schema for OpenAI, a normalizer (array-form records -> objects),
// a deterministic fallback, and the embedding source-text builder.

export interface RawAnswer {
  questionId: string;
  value: string | string[];
}

export interface BasicFields {
  name?: string;
  age?: number;
  gender?: string;
  school?: string;
  majorLabel?: string;
  heightCm?: number | null;
}

const scoreArray = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['key', 'score'],
    properties: { key: { type: 'string' }, score: { type: 'number' } },
  },
};

const dealbreakerArray = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['trait', 'severity', 'reason'],
    properties: {
      trait: { type: 'string' },
      severity: { type: 'string', enum: ['soft', 'medium', 'hard'] },
      reason: { type: ['string', 'null'] },
    },
  },
};

const importanceEnum = { type: 'string', enum: ['none', 'soft', 'medium', 'hard'] };

/** Strict schema mirroring core's AIProfileAnalysis (Records expressed as {key,score} arrays). */
export const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['publicProfile', 'matchingSignals', 'aiReview'],
  properties: {
    publicProfile: {
      type: 'object',
      additionalProperties: false,
      required: ['displayName', 'age', 'gender', 'school', 'major', 'heightCm', 'bio', 'vibeSummary', 'conversationHooks'],
      properties: {
        displayName: { type: 'string' },
        age: { type: 'integer' },
        gender: { type: ['string', 'null'] },
        school: { type: 'string' },
        major: { type: 'string' },
        heightCm: { type: ['integer', 'null'] },
        bio: { type: 'string' },
        vibeSummary: { type: 'string' },
        conversationHooks: { type: 'array', items: { type: 'string' } },
      },
    },
    matchingSignals: {
      type: 'object',
      additionalProperties: false,
      required: [
        'intents', 'intentClarity', 'seriousnessLevel', 'relationshipPace', 'selfTraits', 'interests',
        'vibeTags', 'values', 'personality', 'lifestyle', 'preferredPartnerTraits', 'appearancePreference',
        'communication', 'dealbreakers', 'confidence',
      ],
      properties: {
        intents: { type: 'array', items: { type: 'string' } },
        intentClarity: { type: 'number' },
        seriousnessLevel: { type: 'number' },
        relationshipPace: { type: 'string' },
        selfTraits: { type: 'array', items: { type: 'string' } },
        interests: { type: 'array', items: { type: 'string' } },
        vibeTags: { type: 'array', items: { type: 'string' } },
        values: scoreArray,
        personality: scoreArray,
        lifestyle: scoreArray,
        preferredPartnerTraits: { type: 'array', items: { type: 'string' } },
        appearancePreference: {
          type: 'object',
          additionalProperties: false,
          required: ['importance', 'preferredStyleTags', 'preferredAppearanceVibeTags', 'heightPreference', 'physicalDealbreakers'],
          properties: {
            importance: importanceEnum,
            preferredStyleTags: { type: 'array', items: { type: 'string' } },
            preferredAppearanceVibeTags: { type: 'array', items: { type: 'string' } },
            heightPreference: {
              type: 'object',
              additionalProperties: false,
              required: ['importance', 'minHeightCm', 'maxHeightCm', 'prefersTallerThanSelf', 'prefersShorterThanSelf'],
              properties: {
                importance: importanceEnum,
                minHeightCm: { type: ['integer', 'null'] },
                maxHeightCm: { type: ['integer', 'null'] },
                prefersTallerThanSelf: { type: ['boolean', 'null'] },
                prefersShorterThanSelf: { type: ['boolean', 'null'] },
              },
            },
            physicalDealbreakers: dealbreakerArray,
          },
        },
        communication: {
          type: 'object',
          additionalProperties: false,
          required: ['deepTalk', 'humor', 'textingFrequency', 'directness', 'slowBurn', 'initiatesConversation', 'prefersInPersonSoon', 'emotionalExpression'],
          properties: {
            deepTalk: { type: 'number' },
            humor: { type: 'number' },
            textingFrequency: { type: 'number' },
            directness: { type: 'number' },
            slowBurn: { type: 'number' },
            initiatesConversation: { type: 'number' },
            prefersInPersonSoon: { type: 'number' },
            emotionalExpression: { type: 'number' },
          },
        },
        dealbreakers: dealbreakerArray,
        confidence: { type: 'number' },
      },
    },
    aiReview: {
      type: 'object',
      additionalProperties: false,
      required: ['selfSummary', 'seekingSummary', 'idealMatchSummary', 'avoidSummary', 'suggestedBio'],
      properties: {
        selfSummary: { type: 'string' },
        seekingSummary: { type: 'string' },
        idealMatchSummary: { type: 'string' },
        avoidSummary: { type: 'string' },
        suggestedBio: { type: 'string' },
      },
    },
  },
};

export const ANALYSIS_SYSTEM_PROMPT = [
  'Bạn là trợ lý phân tích hồ sơ cho F-Love, app ghép đôi sinh viên.',
  'Đọc toàn bộ câu trả lời onboarding của một người và trích xuất hồ sơ có cấu trúc theo schema.',
  'Tuyệt đối KHÔNG đánh giá ai đẹp/xấu. Chỉ ghi lại preference do chính người dùng nói ra.',
  'Nếu người dùng nói ngoại hình/chiều cao không quan trọng thì importance để "none" hoặc "soft".',
  'Chỉ đặt dealbreaker severity = "hard" khi người dùng nói rõ là tuyệt đối không chấp nhận.',
  'Tất cả văn bản (bio, vibeSummary, các summary) viết bằng tiếng Việt có dấu, ấm áp, ngắn gọn, không hứa hẹn quá mức.',
  'Các điểm số (score, intentClarity, seriousnessLevel, confidence, communication.*) nằm trong khoảng 0..1.',
].join(' ');

function recordFromPairs(pairs: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pair of Array.isArray(pairs) ? pairs : []) {
    if (pair && typeof pair.key === 'string' && Number.isFinite(pair.score)) out[pair.key] = pair.score;
  }
  return out;
}

/** Converts strict {key,score}[] records back into Record<string,number> objects. */
export function normalizeAnalysis(raw: any): any {
  const signals = raw?.matchingSignals ?? {};
  return {
    ...raw,
    matchingSignals: {
      ...signals,
      values: recordFromPairs(signals.values),
      personality: recordFromPairs(signals.personality),
      lifestyle: recordFromPairs(signals.lifestyle),
    },
  };
}

export function answerText(answers: RawAnswer[], id: string): string {
  const answer = answers.find(a => a.questionId === id);
  if (!answer) return '';
  return Array.isArray(answer.value) ? answer.value.join(', ') : answer.value;
}

function answerList(answers: RawAnswer[], id: string): string[] {
  const answer = answers.find(a => a.questionId === id);
  if (!answer) return [];
  return Array.isArray(answer.value) ? answer.value : answer.value ? [answer.value] : [];
}

/** Builds the 5 embedding source strings from the raw answers + the (confirmed) analysis. */
export function buildVectorTexts(answers: RawAnswer[], analysis: any): Record<string, string> {
  const s = analysis?.matchingSignals ?? {};
  const p = analysis?.publicProfile ?? {};
  const join = (...parts: Array<string | string[] | undefined>) =>
    parts.flat().filter((x): x is string => typeof x === 'string' && x.trim().length > 0).join('. ');

  return {
    self: join(answerText(answers, 'self_text'), s.selfTraits, s.interests, s.vibeTags, p.bio, p.vibeSummary),
    need: join(answerText(answers, 'need_text'), s.intents, `seriousness ${s.seriousnessLevel ?? ''}`, s.relationshipPace),
    preference: join(answerText(answers, 'attraction_text'), answerText(answers, 'appearance_specifics'), s.preferredPartnerTraits, Object.keys(s.values ?? {}), (s.appearancePreference?.preferredStyleTags ?? []), (s.appearancePreference?.preferredAppearanceVibeTags ?? [])),
    communication: join(answerText(answers, 'communication_text'), p.conversationHooks),
    lifestyle: join(answerText(answers, 'self_text'), Object.keys(s.lifestyle ?? {}), s.vibeTags, s.interests),
  };
}

const NEUTRAL_COMMUNICATION = {
  deepTalk: 0.5, humor: 0.5, textingFrequency: 0.5, directness: 0.5,
  slowBurn: 0.5, initiatesConversation: 0.5, prefersInPersonSoon: 0.5, emotionalExpression: 0.5,
};

/** Deterministic analysis used when OpenAI is unavailable so the Review screen still renders. */
export function fallbackAnalysis(answers: RawAnswer[], basic: BasicFields): any {
  const selfText = answerText(answers, 'self_text');
  const needText = answerText(answers, 'need_text');
  const attractionText = answerText(answers, 'attraction_text');
  const importance = (answerText(answers, 'appearance_importance') || 'none') as string;
  const boundaries = answerList(answers, 'boundaries_chips');
  const intents = answerList(answers, 'need_chips');
  const selfChips = answerList(answers, 'self_chips');
  const textLen = [selfText, needText, attractionText].filter(t => t.trim().length >= 40).length;

  return {
    publicProfile: {
      displayName: basic.name ?? '',
      age: basic.age ?? 0,
      gender: basic.gender ?? null,
      school: basic.school ?? '',
      major: basic.majorLabel ?? '',
      heightCm: basic.heightCm ?? null,
      bio: selfText.slice(0, 240) || 'Hồ sơ đang được hoàn thiện.',
      vibeSummary: selfChips.join(', ') || 'Đang cập nhật vibe.',
      conversationHooks: selfChips.slice(0, 4),
    },
    matchingSignals: {
      intents,
      intentClarity: needText.trim().length >= 30 ? 0.6 : 0.3,
      seriousnessLevel: 0.5,
      relationshipPace: 'normal',
      selfTraits: selfChips,
      interests: [],
      vibeTags: selfChips,
      values: {},
      personality: {},
      lifestyle: {},
      preferredPartnerTraits: [],
      appearancePreference: {
        importance: ['none', 'soft', 'medium', 'hard'].includes(importance) ? importance : 'none',
        preferredStyleTags: [],
        preferredAppearanceVibeTags: [],
        heightPreference: { importance: 'none' },
        physicalDealbreakers: [],
      },
      communication: { ...NEUTRAL_COMMUNICATION },
      dealbreakers: boundaries.map(trait => ({ trait, severity: 'medium' as const })),
      confidence: Math.min(1, 0.2 + textLen * 0.2),
    },
    aiReview: {
      selfSummary: selfText || 'Bạn chưa mô tả nhiều về bản thân.',
      seekingSummary: needText || 'Bạn đang khám phá điều mình tìm kiếm.',
      idealMatchSummary: attractionText || 'Bạn cởi mở với nhiều kiểu người.',
      avoidSummary: boundaries.join(', ') || 'Chưa có ranh giới rõ ràng.',
      suggestedBio: selfText.slice(0, 200) || 'Xin chào, rất vui được làm quen!',
    },
  };
}
