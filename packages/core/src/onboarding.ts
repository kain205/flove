import type { OnboardingAnswer, OnboardingSignals, ProfileAiSignals } from './types';

const signalVersion = 'onboarding_v1' as const;

const textMap = [
  { keys: ['nghiem tuc', 'nghiêm túc', 'serious'], bucket: 'intents', value: 'serious_relationship' },
  { keys: ['hen ho nhe nhang', 'hẹn hò nhẹ nhàng', 'casual'], bucket: 'intents', value: 'gentle_dating' },
  { keys: ['hoc', 'học', 'du an', 'dự án', 'study'], bucket: 'intents', value: 'study_partner' },
  { keys: ['ban moi', 'bạn mới', 'friend'], bucket: 'intents', value: 'new_friends_first' },
  { keys: ['so thich', 'sở thích'], bucket: 'intents', value: 'shared_interests' },
  { keys: ['kham pha', 'khám phá'], bucket: 'intents', value: 'explore' },

  { keys: ['co dinh huong', 'có định hướng', 'tham vong', 'tham vọng', 'ambition'], bucket: 'values', value: 'ambition' },
  { keys: ['lang nghe', 'lắng nghe'], bucket: 'values', value: 'empathy' },
  { keys: ['am ap', 'ấm áp', 'warm'], bucket: 'values', value: 'warmth' },
  { keys: ['to mo', 'tò mò', 'curious'], bucket: 'values', value: 'curiosity' },
  { keys: ['on dinh cam xuc', 'ổn định cảm xúc'], bucket: 'values', value: 'emotional_stability' },
  { keys: ['sang tao', 'sáng tạo', 'creative'], bucket: 'values', value: 'creativity' },

  { keys: ['it nhung sau', 'ít nhưng sâu', 'deep', 'sau'], bucket: 'communication', value: 'deep_talk' },
  { keys: ['slow burn'], bucket: 'communication', value: 'slow_burn' },
  { keys: ['nhan tin nhieu', 'nhắn tin nhiều'], bucket: 'communication', value: 'frequent_texting' },
  { keys: ['meme', 'vui ve', 'vui vẻ'], bucket: 'communication', value: 'playful_humor' },
  { keys: ['goi dien', 'gọi điện'], bucket: 'communication', value: 'voice_call' },
  { keys: ['gap ngoai doi', 'gặp ngoài đời'], bucket: 'communication', value: 'meet_soon' },

  { keys: ['party'], bucket: 'dealbreakers', value: 'too_party' },
  { keys: ['hoi hot', 'hời hợt', 'superficial'], bucket: 'dealbreakers', value: 'superficial' },
  { keys: ['khong ro muc tieu', 'không rõ mục tiêu'], bucket: 'dealbreakers', value: 'unclear_intent' },
  { keys: ['ranh gioi', 'ranh giới'], bucket: 'dealbreakers', value: 'poor_boundaries' },
  { keys: ['ghost'], bucket: 'dealbreakers', value: 'ghosting' },
  { keys: ['khong trung thuc', 'không trung thực'], bucket: 'dealbreakers', value: 'dishonesty' },

  { keys: ['cafe', 'ca phe', 'cà phê'], bucket: 'interests', value: 'Coffee' },
  { keys: ['game', 'gaming'], bucket: 'interests', value: 'Gaming' },
  { keys: ['nhac', 'nhạc', 'music'], bucket: 'interests', value: 'Music' },
  { keys: ['doc sach', 'đọc sách', 'reading'], bucket: 'interests', value: 'Reading' },
  { keys: ['code', 'coding'], bucket: 'interests', value: 'Coding' },
  { keys: ['phim', 'movie'], bucket: 'interests', value: 'Movies' },
  { keys: ['du lich', 'du lịch', 'travel'], bucket: 'interests', value: 'Travel' },
  { keys: ['the thao', 'thể thao', 'sport'], bucket: 'interests', value: 'Sports' },
] as const;

const partnerTraitsByValue: Record<string, string> = {
  ambition: 'goal_oriented',
  empathy: 'good_listener',
  warmth: 'emotionally_available',
  curiosity: 'curious',
  emotional_stability: 'stable',
  creativity: 'creative',
};

const personalityByValue: Record<string, string> = {
  ambition: 'Ambitious',
  empathy: 'Thoughtful',
  warmth: 'Chill',
  curiosity: 'Curious',
  creativity: 'Creative',
};

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function values(answer: OnboardingAnswer): string[] {
  return Array.isArray(answer.value) ? answer.value : [answer.value];
}

function addUnique(target: string[], value: string) {
  if (!target.includes(value)) target.push(value);
}

function bump(target: Record<string, number>, key: string, amount = 0.35) {
  target[key] = Math.min(1, Number(((target[key] ?? 0) + amount).toFixed(2)));
}

function answerText(answers: OnboardingAnswer[], questionId: string): string {
  const answer = answers.find(item => item.questionId === questionId);
  if (!answer) return '';
  return values(answer).join(' ');
}

export function extractOnboardingSignals(answers: OnboardingAnswer[]): OnboardingSignals {
  const signals: OnboardingSignals = {
    intents: [],
    values: {},
    interests: [],
    lifestyle: {},
    communication: {},
    personality: {},
    dealbreakers: [],
    preferredPartnerTraits: [],
    vibeTags: [],
    confidence: 0,
    version: signalVersion,
    embeddings: {},
  };

  for (const answer of answers) {
    for (const raw of values(answer)) {
      const normalized = normalizeText(raw);
      for (const item of textMap) {
        if (!item.keys.some(key => normalized.includes(normalizeText(key)))) continue;

        if (item.bucket === 'intents') addUnique(signals.intents, item.value);
        if (item.bucket === 'interests') addUnique(signals.interests, item.value);
        if (item.bucket === 'dealbreakers') addUnique(signals.dealbreakers, item.value);
        if (item.bucket === 'values') {
          bump(signals.values, item.value);
          const partnerTrait = partnerTraitsByValue[item.value];
          const personality = personalityByValue[item.value];
          if (partnerTrait) addUnique(signals.preferredPartnerTraits, partnerTrait);
          if (personality) addUnique(signals.vibeTags, personality);
        }
        if (item.bucket === 'communication') {
          bump(signals.communication, item.value);
          addUnique(signals.vibeTags, item.value);
        }
      }
    }
  }

  const vibe = normalizeText(answerText(answers, 'vibe'));
  if (vibe.includes('chill')) {
    bump(signals.lifestyle, 'chill');
    addUnique(signals.vibeTags, 'Chill');
  }
  if (vibe.includes('hoc') || vibe.includes('study')) bump(signals.lifestyle, 'student_life');
  if (vibe.includes('di dao') || vibe.includes('walk')) bump(signals.lifestyle, 'slow_date');
  if (vibe.includes('party')) bump(signals.lifestyle, 'party');

  for (const tag of signals.vibeTags) {
    const normalized = normalizeText(tag);
    if (normalized.includes('curious')) bump(signals.personality, 'curious');
    if (normalized.includes('chill') || normalized.includes('slow')) bump(signals.personality, 'calm');
    if (normalized.includes('thoughtful') || normalized.includes('deep')) bump(signals.personality, 'thoughtful');
    if (normalized.includes('ambitious')) bump(signals.personality, 'ambitious');
    if (normalized.includes('creative')) bump(signals.personality, 'creative');
  }

  const freeTextCount = ['vibe', 'values_text', 'self_description']
    .map(questionId => answerText(answers, questionId).trim())
    .filter(text => text.length >= 20).length;
  const structuredCount = [
    signals.intents.length,
    Object.keys(signals.values).length,
    Object.keys(signals.communication).length,
    signals.dealbreakers.length,
    signals.interests.length,
  ].reduce((sum, count) => sum + Math.min(count, 3), 0);
  signals.confidence = Math.min(1, Number(((freeTextCount * 0.2) + (structuredCount * 0.07)).toFixed(2)));

  return signals;
}

export function hasCompletedOnboarding(aiSignals?: ProfileAiSignals | null): boolean {
  const onboarding = aiSignals?.onboarding;
  if (!onboarding?.completedAt || onboarding.extractedTraits?.version !== signalVersion) return false;
  const rawAnswers = onboarding.rawAnswers ?? [];
  const hasIntent = rawAnswers.some(answer => answer.questionId === 'intent' && values(answer).length > 0);
  const hasVibe = answerText(rawAnswers, 'vibe').trim().length >= 20;
  const hasSelfDescription = answerText(rawAnswers, 'self_description').trim().length >= 20;
  return hasIntent && hasVibe && hasSelfDescription && onboarding.extractedTraits.confidence >= 0.3;
}
