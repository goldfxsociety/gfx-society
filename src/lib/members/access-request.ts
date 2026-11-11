/**
 * /system/join request form (access journey v2, spec §5 + §9). Pure logic with injected calls so it is unit-tested
 * offline (scripts/test-access-request.mjs). Caller: src/app/system/join/actions.ts. The DB
 * (public.submit_access_request, SECURITY DEFINER, keyed on auth.uid()) re-checks everything; this only validates
 * early and maps its answer to a neutral UI state.
 */

/**
 * Different-ACCM-email confirmation needs an outbound mailer (new provider + secret), which this build does not add
 * (stop rule, 11 Nov). While false: the ACCM email field is not shown and any value is ignored server-side, so nobody
 * is told "we sent a link" when nothing was sent. The DB token flow (issue_accm_confirm_token / confirm_accm_email)
 * and the /system/join/confirm landing are built and tested; flip this only once a mailer is wired and approved.
 */
// When this goes true, restore both ACCM-email passages in src/content/legal/privacy-notice.md
// (section 2 "Access request" bullet and the section 7 retention rows) as Privacy v1.5 with a change note (GFX Design, 11 Nov).
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

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
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

/** Confirmation link for the different-ACCM-email mail (pinned to the site URL, token in the query only). */
export function accmConfirmUrl(siteUrl: string, token: string): string {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error("bad token");
  return `${siteUrl.replace(/\/+$/, "")}/system/join/confirm?token=${token}`;
}
