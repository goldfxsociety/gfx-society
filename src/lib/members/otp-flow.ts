/**
 * One-step passwordless join (Ben's redesign, 2 Nov). Pure logic with injected calls so it can be
 * unit-tested offline (scripts/test-members-otp-flow.mjs). Callers: src/app/system/join/actions.ts.
 */
export type SendResult = "sent" | "consent_required" | "invalid_email" | "error";
export type VerifyResult = "active" | "wrong_code" | "expired_code" | "not_verified" | "error";

export type OtpDeps = {
  /** service_role RPC public.member_code_allowed: boolean only (listed + under rate limits). */
  codeAllowed: (email: string, ip: string) => Promise<boolean | null>;
  sendOtp: (email: string) => Promise<boolean>;
  verifyOtp: (email: string, token: string) => Promise<"ok" | "wrong" | "expired">;
  /** public.record_member_consent(version) as the new OTP session. */
  recordConsent: () => Promise<string | null>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Always returns "sent" for any well-formed request, listed or not (no enumeration). */
export async function requestCode(deps: OtpDeps, rawEmail: string, consent: boolean, ip: string): Promise<SendResult> {
  if (!consent) return "consent_required";
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_RE.test(email) || email.length > 254) return "invalid_email";
  const allowed = await deps.codeAllowed(email, ip);
  if (allowed === null) return "error"; // gate not configured / RPC failed: never send blindly
  if (allowed) await deps.sendOtp(email); // send failures are not revealed either
  return "sent";
}

export async function verifyCode(deps: OtpDeps, rawEmail: string, rawCode: string): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code) || !EMAIL_RE.test(email)) return "wrong_code";
  const v = await deps.verifyOtp(email, code);
  if (v === "wrong") return "wrong_code";
  if (v === "expired") return "expired_code";
  const r = await deps.recordConsent();
  if (r === null) return "error";
  return r === "active" ? "active" : "not_verified";
}
