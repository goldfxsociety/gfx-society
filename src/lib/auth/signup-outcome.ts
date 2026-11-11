/**
 * Maps a Supabase signUp response to the signup page state. Import-free so it is unit-tested offline
 * (scripts/test-signup-confirm.mjs).
 *  - Session returned (Confirm email OFF): logged in now, same as before -> needsEmailConfirmation false.
 *  - No session (Confirm email ON): "check your email" state.
 *  - "Already registered" (only surfaced while Confirm email is OFF): the SAME neutral check-email state,
 *    so the form never says whether an account exists. The check-email copy points existing users to /login.
 */
export type SignupResult = { ok: true; needsEmailConfirmation: boolean } | { ok: false; error: string };

export function isAlreadyRegistered(message: string): boolean {
  return /already (been )?registered|already exists/i.test(message);
}

export function signupOutcome(
  res: { hasSession: boolean; errorMessage: string | null },
  friendlyError: (message: string) => string,
): SignupResult {
  if (res.errorMessage !== null) {
    if (isAlreadyRegistered(res.errorMessage)) return { ok: true, needsEmailConfirmation: true };
    return { ok: false, error: friendlyError(res.errorMessage) };
  }
  return { ok: true, needsEmailConfirmation: !res.hasSession };
}
