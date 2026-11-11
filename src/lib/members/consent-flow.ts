/**
 * /system/join consent step (Academy password login + consent; plan 11 Nov). Pure logic with injected calls
 * so it can be unit-tested offline (scripts/test-members-consent.mjs). Caller: src/app/system/join/actions.ts.
 * The DB (public.record_member_consent, SECURITY DEFINER) is the only thing that decides membership; this only
 * maps its answer to a neutral UI state. No email input, no allowlist lookup before login.
 */
export type ConsentResult =
  | "active"
  | "login_required"
  | "consent_required"
  | "no_match"
  | "unverified_email"
  | "rate_limited"
  | "error";

export type ConsentDeps = {
  /** True when the server-side session has a verified user (supabase.auth.getUser()). */
  loggedIn: () => Promise<boolean>;
  /** public.record_member_consent(MEMBERS_CONSENT_VERSION) with the USER's server client; null on RPC error. */
  recordConsent: () => Promise<string | null>;
};

export async function submitConsent(deps: ConsentDeps, consent: boolean): Promise<ConsentResult> {
  if (!(await deps.loggedIn())) return "login_required";
  if (!consent) return "consent_required";
  const r = await deps.recordConsent();
  if (r === "active" || r === "no_match" || r === "unverified_email" || r === "rate_limited") return r;
  if (r === "none") return "login_required"; // session vanished between the check and the RPC
  return "error";
}
