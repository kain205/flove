import { applyReviewEditsToAnalysis, canonicalizeAnalysis, fallbackAnalysis, type RawAnswer } from './analysis.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('review prose is normalized into bounded soft matching signals', () => {
  const answers: RawAnswer[] = [
    { questionId: 'self_text', value: 'Mình thích đọc sách, làm dự án và nói chuyện rõ ràng vào cuối tuần.' },
    { questionId: 'need_chips', value: ['Serious dating'] },
    { questionId: 'need_text', value: 'Mình muốn tìm hiểu nghiêm túc nhưng bắt đầu chậm rãi.' },
    { questionId: 'attraction_text', value: 'Mình thích người chủ động, tử tế và giao tiếp thẳng thắn.' },
    { questionId: 'appearance_importance', value: 'none' },
    { questionId: 'boundaries_chips', value: [] },
  ];
  const stored = fallbackAnalysis(answers, { name: 'An', age: 21 });
  const result = applyReviewEditsToAnalysis(stored, {
    selfSummary: 'Tò mò, thích đọc sách và làm project.',
    seekingSummary: 'Muốn một mối quan hệ nghiêm túc, tiến chậm.',
    idealMatchSummary: 'Người chủ động, tử tế và giao tiếp rõ ràng.',
    avoidSummary: 'Không hợp với hút thuốc và kiểm soát.',
    suggestedBio: 'Tò mò và chân thành, thích những cuộc trò chuyện rõ ràng.',
  }, answers, { name: 'An', age: 21 });

  assert(result.matchingSignals.intents.includes('nghiêm'), 'Seeking edits must affect intent signals.');
  assert(
    result.matchingSignals.preferredPartnerTraits.includes('chủ'),
    'Ideal-match edits must affect preferred-partner signals.',
  );
  const editedDealbreakers = result.matchingSignals.dealbreakers.filter(
    (item: { reason?: string }) => item.reason === 'User-confirmed review edit',
  );
  assert(editedDealbreakers.length > 0, 'Avoid edits must affect dealbreaker signals.');
  assert(
    editedDealbreakers.every((item: { severity: string }) => item.severity === 'medium'),
    'Free-form review edits must never create hard exclusions.',
  );
});

Deno.test('schema-valid AI hallucinations cannot create hard zero-pool filters', () => {
  const answers: RawAnswer[] = [
    { questionId: 'appearance_importance', value: 'none' },
    { questionId: 'appearance_specifics', value: 'Ngoại hình không quan trọng.' },
    { questionId: 'boundaries_chips', value: [] },
    { questionId: 'boundaries_text', value: 'Mình cởi mở và muốn tìm hiểu từ từ.' },
  ];
  const raw = fallbackAnalysis(answers, { name: 'An', age: 21 });
  raw.matchingSignals.appearancePreference = {
    importance: 'hard',
    preferredStyleTags: [],
    preferredAppearanceVibeTags: [],
    heightPreference: {
      importance: 'hard',
      minHeightCm: 220,
      maxHeightCm: 120,
      prefersTallerThanSelf: true,
      prefersShorterThanSelf: true,
    },
    physicalDealbreakers: [{ trait: 'wears glasses', severity: 'hard', reason: 'hallucinated' }],
  };
  raw.matchingSignals.dealbreakers = [{ trait: 'introvert', severity: 'hard', reason: 'hallucinated' }];

  const result = canonicalizeAnalysis(raw, answers, { name: 'An', age: 21 });
  const appearance = result.matchingSignals.appearancePreference;
  assert(appearance.importance === 'none', 'Explicit none must override AI hard importance.');
  assert(appearance.heightPreference.importance === 'none', 'Unproven height constraints must not be hard.');
  assert(appearance.heightPreference.minHeightCm == null, 'Unmentioned height minimum must be removed.');
  assert(appearance.heightPreference.maxHeightCm == null, 'Unmentioned height maximum must be removed.');
  assert(!appearance.heightPreference.prefersTallerThanSelf, 'Unmentioned taller preference must be false.');
  assert(!appearance.heightPreference.prefersShorterThanSelf, 'Unmentioned shorter preference must be false.');
  assert(
    appearance.physicalDealbreakers.every((item: { severity: string }) => item.severity !== 'hard')
      && result.matchingSignals.dealbreakers.every((item: { severity: string }) => item.severity !== 'hard'),
    'AI-only dealbreakers must be downgraded.',
  );
});

Deno.test('hard language proves only a trait in the same user-authored clause', () => {
  const answers: RawAnswer[] = [
    { questionId: 'appearance_importance', value: 'none' },
    { questionId: 'appearance_specifics', value: 'Ngoại hình không quan trọng.' },
    { questionId: 'boundaries_chips', value: [] },
    { questionId: 'boundaries_text', value: 'Tuyệt đối không hút thuốc; còn đi party thì không sao.' },
  ];
  const raw = fallbackAnalysis(answers, { name: 'An', age: 21 });
  raw.matchingSignals.dealbreakers = [
    { trait: 'hút thuốc', severity: 'hard' },
    { trait: 'party', severity: 'hard' },
  ];

  const dealbreakers = canonicalizeAnalysis(raw, answers, { name: 'An', age: 21 })
    .matchingSignals.dealbreakers;
  assert(dealbreakers[0].severity === 'hard', 'An explicitly hard trait should remain hard.');
  assert(dealbreakers[1].severity === 'medium', 'Hard language from another clause must not authorize a trait.');
});

Deno.test('explicit hard height bounds are verified and contradictions normalized', () => {
  const answers: RawAnswer[] = [
    { questionId: 'appearance_importance', value: 'hard' },
    { questionId: 'appearance_specifics', value: 'Mình bắt buộc muốn chiều cao từ 160 đến 175 cm và cao hơn mình.' },
    { questionId: 'boundaries_chips', value: [] },
    { questionId: 'boundaries_text', value: 'Không có ranh giới cứng.' },
  ];
  const raw = fallbackAnalysis(answers, { name: 'An', age: 21 });
  raw.matchingSignals.appearancePreference.heightPreference = {
    importance: 'hard',
    minHeightCm: 175,
    maxHeightCm: 160,
    prefersTallerThanSelf: true,
    prefersShorterThanSelf: true,
  };

  const height = canonicalizeAnalysis(raw, answers, { name: 'An', age: 21 })
    .matchingSignals.appearancePreference.heightPreference;
  assert(height.importance === 'hard', 'Explicit hard height preference should remain hard.');
  assert(height.minHeightCm === 160 && height.maxHeightCm === 175, 'Reversed bounds must be normalized.');
  assert(height.prefersTallerThanSelf && !height.prefersShorterThanSelf, 'Contradictory directions must be resolved from source text.');
});
