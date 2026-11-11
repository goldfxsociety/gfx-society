/**
 * /system/join request form (access journey v2, spec §5 + §9). Pure logic with injected calls so it is unit-tested
 * offline (scripts/test-access-request.mjs). Caller: src/app/system/join/actions.ts. The DB
 * (public.submit_access_request, SECURITY DEFINER, keyed on auth.uid()) re-checks everything; this only validates
 * early and maps its answer to a neutral UI state.
 */

/**
 * Different-ACCM-email confirmation mailer switch (app side). Default false. While false: the ACCM email field is not
 * shown, any value is ignored server-side, no SMTP env is read, no token is issued and no mail is sent, the
 * /system/join/confirm page offers no confirm button, and /privacy shows Privacy v1.4 (privacy-notice.md).
 * When true: the field shows, the request action mails the link (Gmail SMTP, src/lib/members/accm-confirm-send.ts),
 * and /privacy shows Privacy v1.5 (privacy-notice-v1.5.md, the two ACCM-email passages restored with a change note).
 *
 * Go-live needs ALL of these (Jarvis's go; order and rollback in docs/accm-confirm-mailer.md: DB switch on BEFORE
 * this constant; rollback turns this constant off first): this constant set to true; the DB switch
 * private.app_settings 'accm_confirm_mail_live' = 'true' (migration 20261111130000; while it is off the DB refuses
 * ACCM emails and issues no tokens); GFX_SMTP_USER / GFX_SMTP_APP_PASSWORD / GFX_SMTP_FROM set on Vercel; a hosted
 * check that SUPABASE_SERVICE_ROLE_KEY works for issue_accm_confirm_token; and the v1.5 "Last updated" date set.
 * Keep the two privacy files in step (scripts/test-accm-confirm-mail.mjs checks they differ only in the v1.5 parts).
 */
export const ACCM_CONFIRM_MAIL_LIVE = false;

export type RequestResult =
  | "pending"
  | "awaiting_email_confirm"
  | "matched"
  | "login_required"
  | "unverified_email"
  | "already_member"
  | "invalid_email"
  | "same_email"
  | "consent_required"
  | "rate_limited"
  | "error";

export type RequestInput = { accmEmail: string; ibName: string; consent: boolean };

export type RequestDeps = {
  /** True when the server-side session has a verified user (supabase.auth.getUser()). */
  loggedIn: () => Promise<boolean>;
  /** public.submit_access_request with the USER's server client; null on RPC error. */
  submit: (accmEmail: string | null, ibName: string | null) => Promise<string | null>;
  /** Mailer hook: send the confirmation link. Only called when ACCM_CONFIRM_MAIL_LIVE. */
  sendConfirm?: () => Promise<boolean>;
};

/**
 * ACCM email: plain addr-spec only (QA Q5). No display name, no <>, quotes, commas, spaces, CR/LF or other
 * specials, so the hashed string and the delivered mailbox are always the same address. Same rule in SQL
 * (public.submit_access_request, migration 20261111130000). Max 254 characters.
 */
export const ACCM_EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const EMAIL_RE = ACCM_EMAIL_RE;
const URLISH = [/\S*(?:\/\/|www\.)\S*/gi, /\S+\.(?:com|net|org|io|ph|me|co|info|xyz|link|ly|gg|app|dev|site|online|biz|to|cc|tv)\b\S*/gi];

/** IB / sub-IB name hint: no links, no control characters, max 60 characters (the DB does the same). */
export function cleanIbName(raw: string): string {
  let s = raw.replace(/[\u0000-\u001f\u007f]/g, " ");
  for (const re of URLISH) s = s.replace(re, " ");
  return s.replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Early, field-level checks. Returns the first error for the form (DB re-checks the same rules). */
export function validateRequest(input: RequestInput, academyEmail: string | null, mailLive = ACCM_CONFIRM_MAIL_LIVE): RequestResult | null {
  if (!input.consent) return "consent_required";
  const accm = mailLive ? input.accmEmail.trim().toLowerCase() : "";
  if (accm) {
    if (accm.length > 254 || !EMAIL_RE.test(accm)) return "invalid_email";
    if (academyEmail && accm === academyEmail.trim().toLowerCase()) return "same_email";
  }
  return null;
}

export async function submitRequest(deps: RequestDeps, input: RequestInput, academyEmail: string | null, mailLive = ACCM_CONFIRM_MAIL_LIVE): Promise<RequestResult> {
  if (!(await deps.loggedIn())) return "login_required";
  const early = validateRequest(input, academyEmail, mailLive);
  if (early) return early;
  const accm = mailLive ? input.accmEmail.trim().toLowerCase() || null : null;
  const r = await deps.submit(accm, cleanIbName(input.ibName) || null);
  if (r === "none") return "login_required";
  if (r === "join_consent_required") return "error"; // the form only shows after the join consent; neutral fallback
  if (r === "awaiting_email_confirm") {
    if (!mailLive || !deps.sendConfirm || !(await deps.sendConfirm())) return "error";
    return r;
  }
  if (r === "pending" || r === "matched" || r === "unverified_email" || r === "already_member" || r === "invalid_email" || r === "same_email" || r === "rate_limited") return r;
  return "error";
}

// ---- dates (Asia/Manila, "Dec 1, 2026") ----
const MANILA = "Asia/Manila";
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: MANILA, month: "short", day: "numeric", year: "numeric" });

export function manilaDate(d: Date | string): string {
  return fmt.format(typeof d === "string" ? new Date(d) : d);
}

/** The next 1st of the month in Asia/Manila (always next month's 1st, also when today is the 1st). */
export function nextFirstManila(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: MANILA, year: "numeric", month: "numeric" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value); // 1-12
  // Noon UTC on the 1st is the 1st in Manila too (UTC+8).
  return fmt.format(new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 12)));
}

/**
 * Confirmation link for the different-ACCM-email mail: pinned to the site URL. The token rides in the URL FRAGMENT
 * (#token=...), which browsers never send to a server, so it stays out of request logs, analytics and Referer headers.
 * The page reads it client-side and confirms only on a POST from a button, for the signed-in requester (QA N1).
 */
export function accmConfirmUrl(siteUrl: string, token: string): string {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error("bad token");
  return `${siteUrl.replace(/\/+$/, "")}/system/join/confirm#token=${token}`;
}

export type ConfirmResult = "confirmed" | "invalid" | "login_required";

export type ConfirmDeps = {
  /** True when the server-side session has a verified user (supabase.auth.getUser()). */
  loggedIn: () => Promise<boolean>;
  /** public.confirm_accm_email with the USER's server client (bound to auth.uid() in SQL); null on RPC error. */
  confirm: (token: string) => Promise<string | null>;
};

/** POST confirm (QA N1). Flag off or a malformed token: 'invalid' without any call. One neutral 'invalid' otherwise. */
export async function confirmAccmEmail(deps: ConfirmDeps, token: string, mailLive = ACCM_CONFIRM_MAIL_LIVE): Promise<ConfirmResult> {
  if (!mailLive || !/^[0-9a-f]{64}$/.test(token)) return "invalid";
  if (!(await deps.loggedIn())) return "login_required";
  return (await deps.confirm(token)) === "confirmed" ? "confirmed" : "invalid";
}
