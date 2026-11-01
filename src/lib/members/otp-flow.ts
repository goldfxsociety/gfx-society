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
  /** Runs work after the response (Next `after()`); errors must be logged, never surfaced. */
  defer: (work: () => Promise<unknown>) => void;
  /** Minimum reply time in ms for requestCode (padding hides listed vs unlisted). */
  minReplyMs: () => number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

/** ~1.2s with jitter: every requestCode reply takes at least this long. */
export const replyFloorMs = () => 1200 + Math.floor(Math.random() * 300);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Always returns "sent" for any well-formed request, listed or not (no enumeration). */
export async function requestCode(deps: OtpDeps, rawEmail: string, consent: boolean, ip: string): Promise<SendResult> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const start = now();
  const floor = deps.minReplyMs();
  const result = await requestCodeInner(deps, rawEmail, consent, ip);
  const left = floor - (now() - start);
  if (left > 0) await sleep(left);
  return result;
}

async function requestCodeInner(deps: OtpDeps, rawEmail: string, consent: boolean, ip: string): Promise<SendResult> {
  if (!consent) return "consent_required";
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_RE.test(email) || email.length > 254) return "invalid_email";
  const allowed = await deps.codeAllowed(email, ip);
  if (allowed === null) return "error"; // gate not configured / RPC failed: never send blindly
  // Timing (QA P2-B): the send is never awaited in the response path, so listed and unlisted
  // replies cost the same; failures are logged by the deferred task and never surfaced.
  if (allowed) deps.defer(() => deps.sendOtp(email));
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
