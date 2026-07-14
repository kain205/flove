import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { passwordSignUpResult } from './passwordSignup';

describe('passwordSignUpResult', () => {
  it('surfaces an authenticated signup only when Supabase returned a session', () => {
    const session = { access_token: 'access-token' } as Session;

    expect(passwordSignUpResult(session, 'student@fpt.edu.vn')).toEqual({
      status: 'signed_in',
      session,
    });
  });

  it('requires email confirmation when Supabase returned no session', () => {
    expect(passwordSignUpResult(null, 'student@fpt.edu.vn')).toEqual({
      status: 'confirmation_required',
      session: null,
      email: 'student@fpt.edu.vn',
    });
  });
});
