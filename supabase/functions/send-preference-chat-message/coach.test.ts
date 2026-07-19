import {
  deterministicPreferencePayload,
  normalizePreferenceCoachPayload,
  isPreferenceCoachGreeting,
  preferenceCoachGreetingPayload,
  preferenceCoachAbandonParams,
  preferenceCoachContextFromRow,
  preferenceCoachPromptInput,
  preferenceCoachRequestFingerprint,
  unchangedMemoryFallback,
} from './coach.ts';

Deno.test('short Coach greetings return immediately without changing memory', () => {
  const context = preferenceCoachContextFromRow({
    user_age: 22,
    llm_eligible: true,
    preference_summary: 'Ưu tiên giao tiếp rõ ràng.',
    soft_preferences: ['giao tiếp rõ ràng'],
    soft_avoidances: ['kiểm soát'],
    recent_turns: [],
  });
  assert(isPreferenceCoachGreeting('hi'), 'Expected a short hi greeting.');
  assert(isPreferenceCoachGreeting('Chào Coach ơi!'), 'Expected a Vietnamese Coach greeting.');
  assert(!isPreferenceCoachGreeting('hi, mình thích người hài hước'), 'A preference statement must still use the full flow.');
  const payload = preferenceCoachGreetingPayload(context);
  assert(payload.summary === context.preferenceSummary, 'Greeting changed the summary.');
  assert(payload.preferredTraits[0] === 'giao tiếp rõ ràng', 'Greeting changed preferred memory.');
  assert(payload.avoidedTraits[0] === 'kiểm soát', 'Greeting changed avoided memory.');
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('coach context is owner-bounded before entering a provider prompt', () => {
  const context = preferenceCoachContextFromRow({
    user_age: 21,
    llm_eligible: true,
    profile_context: { review: 'x'.repeat(7_000) },
    preference_summary: 'y'.repeat(2_000),
    soft_preferences: Array.from({ length: 30 }, (_, index) => `trait ${index}`),
    soft_avoidances: ['thiếu tôn trọng'],
    recent_turns: Array.from({ length: 20 }, (_, index) => ({
      sender: index % 2 ? 'assistant' : 'user',
      content: `turn ${index} ${'z'.repeat(2_000)}`,
    })),
  });
  const input = preferenceCoachPromptInput(context, 'm'.repeat(3_000));

  assert(context.profileContext.length === 6_000, 'Expected bounded own-profile context.');
  assert(context.preferenceSummary.length === 1_000, 'Expected bounded memory summary.');
  assert(context.preferredTraits.length === 20, 'Expected bounded canonical traits.');
  assert(context.recentTurns.length === 12, 'Expected only the latest 12 turns.');
  assert(context.recentTurns.every(turn => turn.content.length <= 1_000), 'Expected bounded turn content.');
  assert(input.currentMessage.length === 2_000, 'Expected bounded current message.');
});

Deno.test('strict coach normalization removes overlap without inventing traits', () => {
  const payload = normalizePreferenceCoachPayload({
    reply: ' Mình hiểu rồi. ',
    summary: 'Giao tiếp rõ ràng.',
    preferredTraits: ['Chủ động', 'Tôn trọng', 'chủ động'],
    avoidedTraits: ['tôn trọng', 'Kiểm soát'],
  });
  assert(payload.reply === 'Mình hiểu rồi.', 'Expected normalized Vietnamese reply.');
  assert(payload.preferredTraits.join('|') === 'Chủ động', 'Avoidance must win an exact overlap.');
  assert(payload.avoidedTraits.length === 2, 'Expected canonical avoidances.');
  assert(payload.fallback === false, 'Expected provider result marker.');
});

Deno.test('under-18 deterministic path updates soft memory without a provider', () => {
  const context = preferenceCoachContextFromRow({
    user_age: 17,
    llm_eligible: false,
    preference_summary: 'Ưu tiên: vui vẻ',
    soft_preferences: ['vui vẻ', 'hay kiểm soát'],
    soft_avoidances: [],
    recent_turns: [],
  });
  const payload = deterministicPreferencePayload(
    context,
    'Mình thích người giao tiếp rõ ràng. Mình không thích hay kiểm soát.',
  );

  assert(payload.fallback, 'Deterministic path must be marked as fallback/non-provider.');
  assert(payload.preferredTraits.some(item => item.includes('giao tiếp rõ ràng')), 'Expected explicit preference extraction.');
  assert(payload.avoidedTraits.some(item => item.includes('hay kiểm soát')), 'Expected explicit avoidance extraction.');
  assert(!payload.preferredTraits.includes('hay kiểm soát'), 'Latest avoidance must remove an exact preference.');
});

Deno.test('under-18 deterministic path never infers a preference without an explicit marker', () => {
  const context = preferenceCoachContextFromRow({
    user_age: 17,
    llm_eligible: false,
    preference_summary: 'Ưu tiên: vui vẻ',
    soft_preferences: ['vui vẻ'],
    soft_avoidances: ['hút thuốc'],
    recent_turns: [],
  });
  const payload = deterministicPreferencePayload(context, 'Mình chưa biết gu của mình, chắc cần suy nghĩ thêm.');

  assert(payload.preferredTraits.join('|') === 'vui vẻ', 'Ambiguous prose invented a preferred trait.');
  assert(payload.avoidedTraits.join('|') === 'hút thuốc', 'Ambiguous prose changed an avoidance.');
});

Deno.test('provider fallback leaves canonical preference memory unchanged', () => {
  const context = preferenceCoachContextFromRow({
    user_age: 22,
    llm_eligible: true,
    preference_summary: 'Ưu tiên giao tiếp rõ ràng.',
    soft_preferences: ['giao tiếp rõ ràng'],
    soft_avoidances: ['kiểm soát'],
    recent_turns: [],
  });
  const payload = unchangedMemoryFallback(context);
  assert(payload.summary === context.preferenceSummary, 'Fallback changed the memory summary.');
  assert(payload.preferredTraits.join('|') === context.preferredTraits.join('|'), 'Fallback changed preferred traits.');
  assert(payload.avoidedTraits.join('|') === context.avoidedTraits.join('|'), 'Fallback changed avoided traits.');
});

Deno.test('preference request fingerprint is stable and content-bound', async () => {
  const first = await preferenceCoachRequestFingerprint('  Giao tiếp rõ ràng  ');
  const retry = await preferenceCoachRequestFingerprint('Giao tiếp rõ ràng');
  const changed = await preferenceCoachRequestFingerprint('Chủ động hơn');
  assert(first === retry, 'Whitespace-normalized retry changed its fingerprint.');
  assert(first !== changed, 'Different content reused the same fingerprint.');
  assert(first.length === 64, 'Expected a SHA-256 fingerprint.');
});

Deno.test('preference finalize recovery releases only the matching claim identity', () => {
  const params = preferenceCoachAbandonParams({
    clientRequestId: 'request-1',
    fingerprint: 'fingerprint-1',
    claimToken: 'claim-1',
    expectedUserId: 'user-1',
  });
  assert(params.p_scope === 'preference_chat', 'Expected the preference assistant scope.');
  assert(params.p_client_request_id === 'request-1', 'Expected the same idempotency key.');
  assert(params.p_request_fingerprint === 'fingerprint-1', 'Expected the same request fingerprint.');
  assert(params.p_claim_token === 'claim-1', 'Expected the exact fenced claim token.');
  assert(params.p_expected_user_id === 'user-1', 'Expected the account-switch fence.');
});
