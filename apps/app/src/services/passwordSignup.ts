import type { Session } from '@supabase/supabase-js';

export type PasswordSignUpResult =
  | { status: 'signed_in'; session: Session }
  | { status: 'confirmation_required'; session: null; email: string };

export function passwordSignUpResult(
  session: Session | null,
  email: string,
): PasswordSignUpResult {
  if (session) return { status: 'signed_in', session };
  return { status: 'confirmation_required', session: null, email };
}
