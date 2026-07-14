import { buildLegacyAiSignals, legacyDraftFromBody, sameCanonicalDraft } from './onboarding-compat.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const rawLegacyBody = {
  basic: {
    name: ' An ', age: 20, gender: 'female', lookingForGender: ['male'],
    school: 'FPT', majorLabel: 'SE', major: 'SE', campus: 'HCM',
  },
  answers: [
    { questionId: 'need_chips', value: ['Mối quan hệ nghiêm túc'] },
    { questionId: 'self_text', value: 'Mình thích cà phê, đọc sách và những cuộc trò chuyện thật sự có chiều sâu.' },
    { questionId: 'attraction_text', value: 'Mình bị thu hút bởi người tử tế, chủ động và có mục tiêu rõ ràng trong cuộc sống.' },
    { questionId: 'communication_text', value: 'Mình thích nói chuyện chậm rãi, chân thành và không tạo áp lực phải trả lời ngay.' },
    { questionId: 'boundaries_text', value: 'Mình không hợp với sự thiếu tôn trọng và không trung thực.' },
  ],
  analysis: { matchingSignals: { intents: ['client-forged'] } },
};

Deno.test('legacy adapter builds v2 only from raw answers and basic', () => {
  const draft = legacyDraftFromBody(rawLegacyBody);
  assert(draft?.version === 2, 'Expected a v2 draft.');
  assert(draft.basic.name === 'An', 'Expected normalized basic fields.');
  assert(!JSON.stringify(draft).includes('client-forged'), 'Client structured analysis leaked into the draft.');
});

Deno.test('legacy adapter recognizes an equivalent canonical draft', () => {
  const draft = legacyDraftFromBody(rawLegacyBody);
  assert(draft, 'Expected a legacy draft.');
  assert(sameCanonicalDraft({ ...draft }, draft), 'Expected equivalent drafts to match.');
  assert(!sameCanonicalDraft({ ...draft, step: 5 }, draft), 'Expected a changed draft to differ.');
});

Deno.test('legacy adapter infers the released empty-boundary representation', () => {
  const body = {
    ...rawLegacyBody,
    answers: rawLegacyBody.answers.map(answer => answer.questionId === 'boundaries_text'
      ? { ...answer, value: '' }
      : answer),
  };
  const draft = legacyDraftFromBody(body);
  assert(draft, 'Expected a legacy draft.');
  const unsure = draft.answers.find(answer => answer.questionId === 'boundaries_unsure');
  assert(unsure?.value === 'true', 'Expected the missing legacy flag to be inferred.');
});

Deno.test('legacy route projection contains server-derived completion aliases', () => {
  const draft = legacyDraftFromBody(rawLegacyBody);
  assert(draft, 'Expected a legacy draft.');
  const projected = buildLegacyAiSignals(draft, {
    matchingSignals: { intents: ['serious'], confidence: 0.8, dealbreakers: [{ trait: 'dishonesty' }] },
  });
  const onboarding = projected.onboarding;
  assert(onboarding.extractedTraits.version === 'onboarding_v1', 'Expected the legacy signal version.');
  assert(onboarding.rawAnswers.some(answer => answer.questionId === 'intent'), 'Missing intent alias.');
  assert(onboarding.rawAnswers.some(answer => answer.questionId === 'vibe'), 'Missing vibe alias.');
  assert(onboarding.rawAnswers.some(answer => answer.questionId === 'self_description'), 'Missing self-description alias.');
  assert(onboarding.extractedTraits.dealbreakers[0] === 'dishonesty', 'Expected canonical dealbreaker text.');
});
