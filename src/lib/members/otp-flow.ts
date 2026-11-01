/**
 * One-step passwordless join (Ben's redesign, 2 Nov). Pure logic with injected calls so it can be
 * unit-tested offline (scripts/test-members-otp-flow.mjs). Callers: src/app/system/join/actions.ts.
 */
export type SendResult = "sent" | "consent_required" | "invalid_email" | "error";
export type VerifyResult = "active" | "wrong_code" | "expired_code" | "not_verified" | "error";

export type OtpDeps = {
  /**
   * service_role RPC public.member_code_reserve (migration 20261102200000): a reservation id (string) when
   * listed + under rate limits (the email + IP slot is already reserved, atomically), false when not, null on error.
   * `true` is accepted as "allowed, no reservation id" for test doubles.
   */
  codeAllowed: (email: string, ip: string) => Promise<string | boolean | null>;
  /**
   * service_role RPC public.member_code_finish, after the send attempt: accepted -> keeps THIS request's slot;
   * rejected -> releases only THIS request's reservation (by id) and adds a per-IP reject row;
   * reservation null (no gate call, e.g. missing CAPTCHA token) -> reject row only. Errors are logged, never surfaced.
   */
  recordSend?: (email: string, ip: string, accepted: boolean, reservation: string | null) => Promise<void>;
  /** signInWithOtp; captchaToken is forwarded to Supabase Auth (Turnstile) when present. */
  sendOtp: (email: string, captchaToken?: string) => Promise<boolean>;
  /** True when the Turnstile flag (NEXT_PUBLIC_TURNSTILE_SITE_KEY) is set: a token is then required. */
  captchaRequired?: boolean;
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
export async function requestCode(
  deps: OtpDeps,
  rawEmail: string,
  consent: boolean,
  ip: string,
  captchaToken = "",
): Promise<SendResult> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const start = now();
  const floor = deps.minReplyMs();
  const result = await requestCodeInner(deps, rawEmail, consent, ip, captchaToken.trim());
  const left = floor - (now() - start);
  if (left > 0) await sleep(left);
  return result;
}

async function requestCodeInner(
  deps: OtpDeps,
  rawEmail: string,
  consent: boolean,
  ip: string,
  captchaToken: string,
): Promise<SendResult> {
  if (!consent) return "consent_required";
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_RE.test(email) || email.length > 254) return "invalid_email";
  // CAPTCHA (Ben, option b): with the flag on, no token = no gate call and no send. Supabase Auth
  // verifies the token itself (tokens are single-use, so the app doesn't pre-verify it).
  // Design: a CAPTCHA failure shows the same neutral screen (padded), logged server-side only.
  if (deps.captchaRequired && (!captchaToken || captchaToken.length > 4096)) {
    console.error("[system/join] captcha token missing or invalid; no code sent");
    deps.defer(async () => deps.recordSend?.(email, ip, false, null)); // no reservation: frees nobody's slot (QA #57 P2-1)
    return "sent";
  }
  const allowed = await deps.codeAllowed(email, ip);
  if (allowed === null) return "error"; // gate not configured / RPC failed: never send blindly
  // Timing (QA P2-B): the send is never awaited in the response path, so listed and unlisted
  // replies cost the same; failures are logged by the deferred task and never surfaced.
  // P3-T: the slot is used only after Supabase accepts; rejections go to the per-IP reject bucket.
  const reservation = typeof allowed === "string" ? allowed : null;
  if (allowed)
    deps.defer(async () => {
      let ok = false;
      try {
        ok = await deps.sendOtp(email, deps.captchaRequired ? captchaToken : undefined);
      } finally {
        await deps.recordSend?.(email, ip, ok, reservation);
      }
      return ok;
    });
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
