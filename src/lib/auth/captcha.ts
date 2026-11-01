/**
 * One shared CAPTCHA helper for every Supabase Auth call that Supabase's project-wide CAPTCHA
 * protection checks (signInWithOtp, signUp, signInWithPassword, resetPasswordForEmail, ...).
 * Option A (Ben/Jarvis, 2 Nov): Supabase Auth verifies the Turnstile token itself. There is no
 * app-side siteverify, because tokens are single-use.
 *
 * Flag: NEXT_PUBLIC_TURNSTILE_SITE_KEY. When it's unset, withCaptcha returns `options` untouched
 * (same object, or undefined), so every auth call is byte-for-byte what it was before.
 * Client-safe: no secrets here.
 */
export const CAPTCHA_FIELD = "cf-turnstile-response";

/**
 * Shown in the browser when Turnstile can't load or produce a token (Design-approved, 2 Nov).
 * EN: "The security check didn't load. Refresh the page or turn off your ad blocker, then try again."
 */
export const CAPTCHA_LOAD_ERROR = "Hindi ma-load ang security check. I-refresh ang page o i-off muna ang ad blocker, tapos subukan ulit.";
export const CAPTCHA_REFRESH_LABEL = "I-refresh";
/** No token this long after mount = treat as a load failure. */
export const CAPTCHA_TIMEOUT_MS = 10_000;

export type CaptchaState = { token: string; status: "off" | "pending" | "ok" | "error" };
export type CaptchaEvent = { type: "token"; token: string } | { type: "expired" | "error" | "load-failed" | "timeout" };

/** Browser-side status. Any failure disables submit and shows CAPTCHA_LOAD_ERROR; a later token recovers. */
export function captchaReducer(s: CaptchaState, e: CaptchaEvent): CaptchaState {
  if (s.status === "off") return s;
  if (e.type === "token") return e.token ? { token: e.token, status: "ok" } : s;
  if (e.type === "timeout") return s.status === "pending" ? { token: "", status: "error" } : s;
  return { token: "", status: "error" };
}
export const initialCaptchaState = (): CaptchaState => ({ token: "", status: captchaEnabled() ? "pending" : "off" });
/** Submit allowed only with a token when the flag is on; always allowed when off. */
export const captchaBlocksSubmit = (s: CaptchaState) => s.status !== "off" && s.status !== "ok";

/** Read at call time so tests can flip it; Next inlines NEXT_PUBLIC_* at build. */
export function captchaEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/** Longest token accepted (Turnstile tokens are ~2KB; anything longer is junk). */
export const CAPTCHA_MAX_LEN = 4096;

export function cleanCaptchaToken(raw: unknown): string {
  const t = typeof raw === "string" ? raw.trim() : "";
  return t && t.length <= CAPTCHA_MAX_LEN ? t : "";
}

/** Adds options.captchaToken when the flag is on and a token is present; otherwise returns options as-is. */
export function withCaptcha<T extends object>(options: T, token: unknown): T & { captchaToken?: string };
export function withCaptcha<T extends object>(options: T | undefined, token: unknown): (T & { captchaToken?: string }) | undefined;
export function withCaptcha<T extends object>(options: T | undefined, token: unknown) {
  if (!captchaEnabled()) return options;
  const captchaToken = cleanCaptchaToken(token);
  if (!captchaToken) return options;
  return { ...(options ?? ({} as T)), captchaToken };
}

/** Supabase's error when CAPTCHA verification fails (e.g. "captcha verification process failed"). */
export function isCaptchaError(message: string | undefined | null): boolean {
  return /captcha/i.test(message ?? "");
}
