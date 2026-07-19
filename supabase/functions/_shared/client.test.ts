import { expectedUserFenceResponse, isValidAccountEmail, jsonObjectBody } from './client.ts';

function assert(condition: unknown, message = 'Assertion failed.'): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('JSON body parser rejects null, arrays and primitives without throwing', async () => {
  for (const value of ['null', '[]', '"text"', '7']) {
    const parsed = await jsonObjectBody(new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: value,
    }));
    assert(Object.keys(parsed).length === 0, `Expected an empty object for ${value}.`);
  }
});

Deno.test('JSON body parser preserves an object payload', async () => {
  const parsed = await jsonObjectBody(new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId: 'm1' }),
  }));
  assert(parsed.matchId === 'm1', 'Expected the object payload to survive parsing.');
});

Deno.test('expected-user fence rejects missing revision ownership and account switches', async () => {
  const missing = expectedUserFenceResponse({}, 'user-a', 'request-1', true);
  assert(missing?.status === 400, 'A required expected user must be present.');
  const missingBody = await missing.json();
  assert(missingBody.error?.code === 'expected_user_required', 'Expected a missing-owner error code.');

  const switched = expectedUserFenceResponse({ expectedUserId: 'user-a' }, 'user-b', 'request-2');
  assert(switched?.status === 409, 'An account switch must be rejected.');
  const switchedBody = await switched.json();
  assert(switchedBody.error?.code === 'session_changed', 'Expected an account-switch error code.');

  assert(
    expectedUserFenceResponse({ expectedUserId: 'user-a' }, 'user-a', 'request-3') === null,
    'The authenticated owner should pass the fence.',
  );
});

Deno.test('FPT admission validates the verified account email exactly', () => {
  assert(isValidAccountEmail('student@fpt.edu.vn'));
  assert(isValidAccountEmail('Student.Name+app@fpt.edu.vn'));
  assert(isValidAccountEmail('student@gmail.com'));
  assert(!isValidAccountEmail('not-an-email'));
  assert(!isValidAccountEmail('missing@tld'));
});
