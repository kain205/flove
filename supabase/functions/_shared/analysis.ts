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
  genderText?: string;
  lookingForGender?: string[];
  school?: string;
  majorLabel?: string;
  major?: string;
  campus?: string;
  avatarUrl?: string;
  heightCm?: number | null;
  agePrefMin?: number | null;
  agePrefMax?: number | null;
}

export interface OnboardingDraftPayload {
  version: 2;
  step: number;
  basic: BasicFields;
  answers: RawAnswer[];
}

export interface ReviewEdits {
  selfSummary: string;
  seekingSummary: string;
  idealMatchSummary: string;
  avoidSummary: string;
  suggestedBio: string;
}

export const ONBOARDING_V2_ANSWER_IDS = [
  'need_chips',
  'need_text',
  'self_chips',
  'self_text',
  'attraction_text',
  'appearance_importance',
  'appearance_specifics',
  'communication_text',
  'boundaries_chips',
  'boundaries_text',
  'boundaries_unsure',
] as const;

const ONBOARDING_V2_ANSWER_ID_SET = new Set<string>(ONBOARDING_V2_ANSWER_IDS);
const MAX_ONBOARDING_TOTAL_CHARS = 24_000;

const boundedString = (maxLength: number) => ({ type: 'string', maxLength });
const boundedStringArray = (maxItems = 30, maxLength = 200) => ({
  type: 'array',
  maxItems,
  items: boundedString(maxLength),
});

const scoreArray = {
  type: 'array',
  maxItems: 30,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['key', 'score'],
    properties: { key: boundedString(100), score: { type: 'number', minimum: 0, maximum: 1 } },
  },
};

const dealbreakerArray = {
  type: 'array',
  maxItems: 30,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['trait', 'severity', 'reason'],
    properties: {
      trait: boundedString(200),
      severity: { type: 'string', enum: ['soft', 'medium', 'hard'] },
      reason: { type: ['string', 'null'], maxLength: 500 },
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
        displayName: boundedString(120),
        age: { type: 'integer', minimum: 17, maximum: 120 },
        gender: { type: ['string', 'null'], maxLength: 60 },
        school: boundedString(200),
        major: boundedString(200),
        heightCm: { type: ['integer', 'null'], minimum: 120, maximum: 230 },
        bio: boundedString(500),
        vibeSummary: boundedString(500),
        conversationHooks: boundedStringArray(10, 200),
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
        intents: boundedStringArray(),
        intentClarity: { type: 'number', minimum: 0, maximum: 1 },
        seriousnessLevel: { type: 'number', minimum: 0, maximum: 1 },
        relationshipPace: boundedString(100),
        selfTraits: boundedStringArray(),
        interests: boundedStringArray(),
        vibeTags: boundedStringArray(),
        values: scoreArray,
        personality: scoreArray,
        lifestyle: scoreArray,
        preferredPartnerTraits: boundedStringArray(),
        appearancePreference: {
          type: 'object',
          additionalProperties: false,
          required: ['importance', 'preferredStyleTags', 'preferredAppearanceVibeTags', 'heightPreference', 'physicalDealbreakers'],
          properties: {
            importance: importanceEnum,
            preferredStyleTags: boundedStringArray(20, 200),
            preferredAppearanceVibeTags: boundedStringArray(20, 200),
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
            deepTalk: { type: 'number', minimum: 0, maximum: 1 },
            humor: { type: 'number', minimum: 0, maximum: 1 },
            textingFrequency: { type: 'number', minimum: 0, maximum: 1 },
            directness: { type: 'number', minimum: 0, maximum: 1 },
            slowBurn: { type: 'number', minimum: 0, maximum: 1 },
            initiatesConversation: { type: 'number', minimum: 0, maximum: 1 },
            prefersInPersonSoon: { type: 'number', minimum: 0, maximum: 1 },
            emotionalExpression: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
        dealbreakers: dealbreakerArray,
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    aiReview: {
      type: 'object',
      additionalProperties: false,
      required: ['selfSummary', 'seekingSummary', 'idealMatchSummary', 'avoidSummary', 'suggestedBio'],
      properties: {
        selfSummary: boundedString(1_000),
        seekingSummary: boundedString(1_000),
        idealMatchSummary: boundedString(1_000),
        avoidSummary: boundedString(1_000),
        suggestedBio: boundedString(500),
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
  'Không tạo quá 30 mục cho bất kỳ danh sách nào và giữ mọi đoạn văn dưới 1.000 ký tự.',
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
  const review = analysis?.aiReview ?? {};
  const join = (...parts: Array<string | string[] | undefined>) =>
    parts.flat().filter((x): x is string => typeof x === 'string' && x.trim().length > 0).join('. ');

  return {
    self: join(answerText(answers, 'self_text'), review.selfSummary, s.selfTraits, s.interests, s.vibeTags, p.bio, p.vibeSummary),
    need: join(answerText(answers, 'need_text'), review.seekingSummary, s.intents, `seriousness ${s.seriousnessLevel ?? ''}`, s.relationshipPace),
    preference: join(answerText(answers, 'attraction_text'), answerText(answers, 'appearance_specifics'), review.idealMatchSummary, review.avoidSummary, s.preferredPartnerTraits, Object.keys(s.values ?? {}), (s.appearancePreference?.preferredStyleTags ?? []), (s.appearancePreference?.preferredAppearanceVibeTags ?? [])),
    communication: join(answerText(answers, 'communication_text'), p.conversationHooks),
    lifestyle: join(answerText(answers, 'self_text'), review.selfSummary, Object.keys(s.lifestyle ?? {}), s.vibeTags, s.interests),
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

function object(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function text(value: unknown, max = 1_000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function texts(value: unknown, maxItems = 30): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.slice(0, maxItems).map(item => text(item, 200)).filter(Boolean)));
}

function score(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, numeric));
}

function scoreRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(object(value)).slice(0, 50).flatMap(([key, value]) => {
    const cleanKey = text(key, 100);
    return cleanKey ? [[cleanKey, score(value)]] : [];
  }));
}

function integerOrNull(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

export function onboardingDraftFromJson(value: unknown): OnboardingDraftPayload | null {
  const raw = object(value);
  if (raw.version !== 2) return null;
  const rawBasic = object(raw.basic);
  const basic: BasicFields = {
    name: text(rawBasic.name, 120),
    age: integerOrNull(rawBasic.age, 0, 120) ?? undefined,
    gender: text(rawBasic.gender, 60),
    genderText: text(rawBasic.genderText, 120),
    lookingForGender: texts(rawBasic.lookingForGender, 10),
    school: text(rawBasic.school, 200),
    majorLabel: text(rawBasic.majorLabel, 200),
    major: text(rawBasic.major, 40),
    campus: text(rawBasic.campus, 40),
    avatarUrl: text(rawBasic.avatarUrl, 2_048),
    heightCm: integerOrNull(rawBasic.heightCm, 120, 230),
    agePrefMin: integerOrNull(rawBasic.agePrefMin, 17, 120),
    agePrefMax: integerOrNull(rawBasic.agePrefMax, 17, 120),
  };
  const answers: RawAnswer[] = Array.isArray(raw.answers)
    ? raw.answers.slice(0, 50).flatMap((item: unknown) => {
      const answer = object(item);
      const questionId = text(answer.questionId, 100);
      if (!questionId) return [];
      return [{ questionId, value: Array.isArray(answer.value) ? texts(answer.value) : text(answer.value, 4_000) }];
    })
    : [];
  return {
    version: 2,
    step: Math.max(0, Math.min(6, Math.trunc(Number(raw.step) || 0))),
    basic,
    answers,
  };
}

export function validateOnboardingDraft(draft: OnboardingDraftPayload): string | null {
  if (draft.answers.length > ONBOARDING_V2_ANSWER_IDS.length) return 'Bản nháp có quá nhiều câu trả lời.';
  const ids = draft.answers.map(answer => answer.questionId);
  if (ids.some(id => !ONBOARDING_V2_ANSWER_ID_SET.has(id))) return 'Bản nháp chứa câu hỏi không được hỗ trợ.';
  if (new Set(ids).size !== ids.length) return 'Mỗi câu hỏi onboarding chỉ được trả lời một lần.';
  let totalChars = 0;
  for (const answer of draft.answers) {
    const values = Array.isArray(answer.value) ? answer.value : [answer.value];
    if (values.length > 20 || values.some(value => value.length > 4_000)) {
      return 'Một câu trả lời onboarding vượt quá giới hạn.';
    }
    totalChars += values.reduce((sum, value) => sum + value.length, 0);
  }
  if (totalChars > MAX_ONBOARDING_TOTAL_CHARS) return 'Tổng nội dung onboarding vượt quá giới hạn.';
  if (!['HCM', 'Hanoi', 'Danang', 'Cantho'].includes(String(draft.basic.campus))) return 'Cơ sở học chưa hợp lệ.';
  if (!['SE', 'AI', 'Biz', 'Design', 'Marketing'].includes(String(draft.basic.major))) return 'Ngành học chưa hợp lệ.';
  if (!['male', 'female', 'other', 'prefer_not_to_show'].includes(String(draft.basic.gender))) return 'Giới tính chưa hợp lệ.';
  if (text(draft.basic.name).length < 2) return 'Tên hiển thị chưa hợp lệ.';
  if ((draft.basic.age ?? 0) < 17) return 'Tuổi cần từ 17 trở lên.';
  if (!text(draft.basic.gender)) return 'Giới tính chưa được chọn.';
  if ((draft.basic.lookingForGender?.length ?? 0) === 0) return 'Đối tượng muốn được gợi ý chưa được chọn.';
  if (draft.basic.lookingForGender?.some(value => !['male', 'female', 'everyone', 'depends'].includes(value))) {
    return 'Lựa chọn đối tượng gợi ý chưa hợp lệ.';
  }
  if (!text(draft.basic.school) || !text(draft.basic.majorLabel)) return 'Trường và ngành học chưa đầy đủ.';
  if (answerList(draft.answers, 'need_chips').length === 0) return 'Mục tiêu sử dụng F-Love chưa đầy đủ.';
  if (answerText(draft.answers, 'self_text').trim().length < 50) return 'Mô tả bản thân cần tối thiểu 50 ký tự.';
  if (answerText(draft.answers, 'attraction_text').trim().length < 50) return 'Mô tả gu thu hút cần tối thiểu 50 ký tự.';
  if (answerText(draft.answers, 'communication_text').trim().length < 40) return 'Mô tả cách trò chuyện cần tối thiểu 40 ký tự.';
  const boundaryUnsure = answerText(draft.answers, 'boundaries_unsure') === 'true';
  if (!boundaryUnsure && answerText(draft.answers, 'boundaries_text').trim().length < 30) {
    return 'Mô tả ranh giới cần tối thiểu 30 ký tự.';
  }
  return null;
}

export function normalizeReviewEdits(value: unknown): ReviewEdits {
  const raw = object(value);
  return {
    selfSummary: text(raw.selfSummary),
    seekingSummary: text(raw.seekingSummary),
    idealMatchSummary: text(raw.idealMatchSummary),
    avoidSummary: text(raw.avoidSummary),
    suggestedBio: text(raw.suggestedBio, 500),
  };
}

/** Rebuilds a safe canonical analysis from server-owned AI/fallback output. */
export function canonicalizeAnalysis(rawValue: unknown, answers: RawAnswer[], basic: BasicFields): any {
  const fallback = fallbackAnalysis(answers, basic);
  const raw = object(rawValue);
  const publicProfile = object(raw.publicProfile);
  const signals = object(raw.matchingSignals);
  const appearance = object(signals.appearancePreference);
  const height = object(appearance.heightPreference);
  const communication = object(signals.communication);
  const review = object(raw.aiReview);
  const importance = (value: unknown): 'none' | 'soft' | 'medium' | 'hard' =>
    ['none', 'soft', 'medium', 'hard'].includes(String(value))
      ? String(value) as 'none' | 'soft' | 'medium' | 'hard'
      : 'none';
  const appearanceImportance = importance(answerText(answers, 'appearance_importance'));
  const appearanceSource = answerText(answers, 'appearance_specifics').toLocaleLowerCase();
  const boundarySource = [
    answerText(answers, 'boundaries_text'),
    answerText(answers, 'boundaries_chips'),
  ].join('. ').toLocaleLowerCase();
  const explicitHardLanguage = (source: string) =>
    /(?:tuyệt đối|không chấp nhận|không bao giờ|bắt buộc|deal[ -]?breaker|\bmust\b|\bnever\b)/iu.test(source);
  const hardTraitIsExplicit = (trait: string, source: string) => {
    const normalizedTrait = trait.toLocaleLowerCase().trim();
    if (normalizedTrait.length < 3) return false;
    return source
      .split(/[,.!?;:\n]+/u)
      .some(clause => explicitHardLanguage(clause) && clause.includes(normalizedTrait));
  };
  const dealbreakers = (value: unknown, source: string) => Array.isArray(value) ? value.slice(0, 30).flatMap(item => {
    const entry = object(item);
    const trait = text(entry.trait, 200);
    if (!trait) return [];
    const proposedSeverity = ['soft', 'medium', 'hard'].includes(String(entry.severity)) ? entry.severity : 'soft';
    const severity = proposedSeverity === 'hard' && !hardTraitIsExplicit(trait, source)
      ? 'medium'
      : proposedSeverity;
    return [{ trait, severity, ...(text(entry.reason, 500) ? { reason: text(entry.reason, 500) } : {}) }];
  }) : [];
  const explicitHeights = new Set(
    Array.from(appearanceSource.matchAll(/\b(1[2-9]\d|2[0-2]\d|230)\b/gu), match => Number(match[1])),
  );
  const verifiedHeight = (value: unknown) => {
    const parsed = integerOrNull(value, 120, 230);
    return parsed != null && explicitHeights.has(parsed) ? parsed : null;
  };
  let minHeightCm = verifiedHeight(height.minHeightCm);
  let maxHeightCm = verifiedHeight(height.maxHeightCm);
  if (minHeightCm != null && maxHeightCm != null && minHeightCm > maxHeightCm) {
    [minHeightCm, maxHeightCm] = [maxHeightCm, minHeightCm];
  }
  const mentionsTaller = /(?:cao hơn|taller)/iu.test(appearanceSource);
  const mentionsShorter = /(?:thấp hơn|lùn hơn|shorter)/iu.test(appearanceSource);
  const proposedTaller = height.prefersTallerThanSelf === true && mentionsTaller;
  const proposedShorter = height.prefersShorterThanSelf === true && mentionsShorter;
  const hasVerifiedHeightConstraint = minHeightCm != null || maxHeightCm != null
    || (proposedTaller !== proposedShorter);
  const heightImportance = appearanceImportance === 'hard' && hasVerifiedHeightConstraint
    ? 'hard'
    : appearanceImportance === 'hard' ? 'medium' : appearanceImportance;

  return {
    publicProfile: {
      displayName: text(publicProfile.displayName, 120) || fallback.publicProfile.displayName,
      age: integerOrNull(publicProfile.age, 0, 120) ?? fallback.publicProfile.age,
      gender: text(publicProfile.gender, 60) || fallback.publicProfile.gender,
      school: text(publicProfile.school, 200) || fallback.publicProfile.school,
      major: text(publicProfile.major, 200) || fallback.publicProfile.major,
      heightCm: integerOrNull(publicProfile.heightCm, 120, 230) ?? fallback.publicProfile.heightCm,
      bio: text(publicProfile.bio, 500) || fallback.publicProfile.bio,
      vibeSummary: text(publicProfile.vibeSummary, 500) || fallback.publicProfile.vibeSummary,
      conversationHooks: texts(publicProfile.conversationHooks, 10),
    },
    matchingSignals: {
      intents: texts(signals.intents),
      intentClarity: score(signals.intentClarity, fallback.matchingSignals.intentClarity),
      seriousnessLevel: score(signals.seriousnessLevel, fallback.matchingSignals.seriousnessLevel),
      relationshipPace: text(signals.relationshipPace, 100) || fallback.matchingSignals.relationshipPace,
      selfTraits: texts(signals.selfTraits),
      interests: texts(signals.interests),
      vibeTags: texts(signals.vibeTags),
      values: scoreRecord(signals.values),
      personality: scoreRecord(signals.personality),
      lifestyle: scoreRecord(signals.lifestyle),
      preferredPartnerTraits: texts(signals.preferredPartnerTraits),
      appearancePreference: {
        // This control is an explicit user selection. A schema-valid model
        // response cannot promote a softer choice into a hard exclusion.
        importance: appearanceImportance,
        preferredStyleTags: texts(appearance.preferredStyleTags),
        preferredAppearanceVibeTags: texts(appearance.preferredAppearanceVibeTags),
        heightPreference: {
          importance: heightImportance,
          ...(minHeightCm != null ? { minHeightCm } : {}),
          ...(maxHeightCm != null ? { maxHeightCm } : {}),
          prefersTallerThanSelf: proposedTaller && !proposedShorter,
          prefersShorterThanSelf: proposedShorter && !proposedTaller,
        },
        physicalDealbreakers: dealbreakers(appearance.physicalDealbreakers, appearanceSource),
      },
      communication: {
        deepTalk: score(communication.deepTalk, 0.5),
        humor: score(communication.humor, 0.5),
        textingFrequency: score(communication.textingFrequency, 0.5),
        directness: score(communication.directness, 0.5),
        slowBurn: score(communication.slowBurn, 0.5),
        initiatesConversation: score(communication.initiatesConversation, 0.5),
        prefersInPersonSoon: score(communication.prefersInPersonSoon, 0.5),
        emotionalExpression: score(communication.emotionalExpression, 0.5),
      },
      dealbreakers: dealbreakers(signals.dealbreakers, boundarySource),
      confidence: score(signals.confidence, fallback.matchingSignals.confidence),
    },
    aiReview: {
      selfSummary: text(review.selfSummary) || fallback.aiReview.selfSummary,
      seekingSummary: text(review.seekingSummary) || fallback.aiReview.seekingSummary,
      idealMatchSummary: text(review.idealMatchSummary) || fallback.aiReview.idealMatchSummary,
      avoidSummary: text(review.avoidSummary) || fallback.aiReview.avoidSummary,
      suggestedBio: text(review.suggestedBio, 500) || fallback.aiReview.suggestedBio,
    },
  };
}

const REVIEW_STOP_WORDS = new Set([
  'anh', 'ban', 'bạn', 'cac', 'các', 'cho', 'co', 'có', 'cua', 'của', 'duoc', 'được',
  'hon', 'hơn', 'khong', 'không', 'la', 'là', 'minh', 'mình', 'mot', 'một', 'nguoi',
  'người', 'nhung', 'nhưng', 'nhung', 'những', 'rat', 'rất', 'thi', 'thì', 'toi', 'tôi',
  'trong', 'va', 'và', 'voi', 'với', 'thich', 'thích', 'muon', 'muốn', 'tim', 'tìm',
  'hop', 'hợp', 'want', 'with', 'that', 'this', 'the', 'and',
]);

export function extractMatchingTextTags(value: string, max = 16): string[] {
  const normalized = value.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const phrases = normalized
    .split(/[,.;!?:\n]|\s+(?:và|hoặc|nhưng|and|or|but)\s+/giu)
    .map(item => item.trim().replace(/\s+/g, ' '))
    .filter(item => item.length >= 3 && item.length <= 100);
  const words = normalized
    .split(/[^\p{L}\p{N}]+/gu)
    .map(item => item.trim())
    .filter(item => item.length >= 3 && !REVIEW_STOP_WORDS.has(item));
  const ngrams = words.flatMap((_, index) => [
    words.slice(index, index + 2).join(' '),
    words.slice(index, index + 3).join(' '),
  ]).filter(item => item.split(' ').length >= 2 && item.length <= 100);
  return Array.from(new Set([...phrases, ...words, ...ngrams])).slice(0, max);
}

function mergeTextSignals(existing: unknown, additions: string[], max = 30): string[] {
  return Array.from(new Set([...texts(existing, max), ...additions])).slice(0, max);
}

/**
 * Converts editable prose back into bounded canonical signals on the server.
 * Review text can add soft ranking evidence, but can never mint hard consent or
 * safety exclusions; existing explicit hard dealbreakers remain authoritative.
 */
export function applyReviewEditsToAnalysis(
  storedValue: unknown,
  reviewValue: unknown,
  answers: RawAnswer[],
  basic: BasicFields,
): any {
  const stored = canonicalizeAnalysis(storedValue, answers, basic);
  const edits = normalizeReviewEdits(reviewValue);
  const review = {
    selfSummary: edits.selfSummary || stored.aiReview.selfSummary,
    seekingSummary: edits.seekingSummary || stored.aiReview.seekingSummary,
    idealMatchSummary: edits.idealMatchSummary || stored.aiReview.idealMatchSummary,
    avoidSummary: edits.avoidSummary || stored.aiReview.avoidSummary,
    suggestedBio: edits.suggestedBio || stored.aiReview.suggestedBio,
  };
  const selfTags = extractMatchingTextTags(review.selfSummary);
  const seekingTags = extractMatchingTextTags(review.seekingSummary);
  const idealTags = extractMatchingTextTags(review.idealMatchSummary);
  const avoidTags = extractMatchingTextTags(review.avoidSummary, 12);
  const existingDealbreakers = Array.isArray(stored.matchingSignals.dealbreakers)
    ? stored.matchingSignals.dealbreakers
    : [];
  const existingTraits = new Set(existingDealbreakers.map((item: any) => String(item?.trait ?? '').toLocaleLowerCase()));
  const reviewDealbreakers = avoidTags
    .filter(trait => !existingTraits.has(trait.toLocaleLowerCase()))
    .map(trait => ({ trait, severity: 'medium', reason: 'User-confirmed review edit' }));

  return canonicalizeAnalysis({
    ...stored,
    publicProfile: { ...stored.publicProfile, bio: review.suggestedBio || stored.publicProfile.bio },
    matchingSignals: {
      ...stored.matchingSignals,
      intents: mergeTextSignals(stored.matchingSignals.intents, seekingTags),
      selfTraits: mergeTextSignals(stored.matchingSignals.selfTraits, selfTags),
      vibeTags: mergeTextSignals(stored.matchingSignals.vibeTags, selfTags),
      preferredPartnerTraits: mergeTextSignals(stored.matchingSignals.preferredPartnerTraits, idealTags),
      dealbreakers: [...existingDealbreakers, ...reviewDealbreakers].slice(0, 30),
      confidence: Math.max(stored.matchingSignals.confidence ?? 0, 0.5),
    },
    aiReview: review,
  }, answers, basic);
}
