/**
 * Different-ACCM-email confirmation mail (Gmail SMTP via nodemailer, Ben's pick 11 Nov). Pure logic with injected
 * calls so it is unit-tested offline (scripts/test-accm-confirm-mail.mjs). Server wiring with the real transport and
 * the service-role RPC: src/lib/members/accm-confirm-send.ts. Only runs when ACCM_CONFIRM_MAIL_LIVE is true.
 *
 * Rules: SMTP env is read only when the flag is on and only on the server; missing env fails closed BEFORE a token is
 * issued; the link is pinned to the site URL (never a request host); the token travels only in the URL fragment
 * (#token=, never sent to a server, so it is not in request logs or analytics); nothing here logs or returns the
 * address or the token. Logs carry fixed codes only.
 */

import { ACCM_EMAIL_RE, accmConfirmUrl } from "./access-request";

export const GMAIL_SMTP = { host: "smtp.gmail.com", port: 465, secure: true } as const;

/** QA Q4: bound every SMTP phase (~10 s each) so a hung Gmail connection ends in the neutral error, well before the
 * platform function timeout. nodemailer defaults are 120 s / 30 s / 600 s. */
export const SMTP_TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000 } as const;

export type MailConfig = { user: string; pass: string; from: string };

/** GFX_SMTP_USER / GFX_SMTP_APP_PASSWORD / GFX_SMTP_FROM. Any missing or blank -> null (fail closed). */
export function readMailConfig(env: Record<string, string | undefined>): MailConfig | null {
  const user = env.GFX_SMTP_USER?.trim();
  const pass = env.GFX_SMTP_APP_PASSWORD?.trim();
  const from = env.GFX_SMTP_FROM?.trim();
  if (!user || !pass || !from) return null;
  return { user, pass, from };
}

/** Answer of public.issue_accm_confirm_token (service role): {email, token} or {error: 'none' | 'rate_limited'}. */
export type IssueResult = { email?: unknown; token?: unknown; error?: unknown } | null;

/** `to` as an object with an empty name (QA Q5): nodemailer never parses the address string for a display name. */
export type MailMessage = { from: string; to: { name: ""; address: string }; subject: string; text: string; html: string };

export type SendDeps = {
  /** null = flag on but SMTP env missing. */
  config: MailConfig | null;
  /** NEXT_PUBLIC_SITE_URL (pinned). */
  siteUrl: string;
  /** public.issue_accm_confirm_token(<server-verified user id>) with the service-role client; null on RPC error. */
  issueToken: () => Promise<IssueResult>;
  /** transport.sendMail; throws on failure. */
  send: (msg: MailMessage) => Promise<void>;
  /** Fixed-code logger (default console.error). Never receives the address, the token or an error object. */
  log?: (code: string) => void;
};

export type SendResult = "sent" | "none" | "rate_limited" | "error";

const TOKEN_RE = /^[0-9a-f]{64}$/;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const ACCM_CONFIRM_MAIL_COPY = {
  subject: "I-confirm ang ACCM email mo / Confirm your ACCM email (GFX Society)",
  tl: [
    "May nag-request ng access sa GFX Trading System at nilagay ang email na ito bilang ACCM email.",
    "Para i-confirm: buksan ang link sa ibaba, mag-log in gamit ang Academy account na nag-request, tapos pindutin ang confirm button. Isang beses lang gumagana ang link, at mag-e-expire ito after 24 hours.",
    "Kung hindi ikaw ang nag-request, i-ignore lang ang email na ito. Walang mangyayari kung hindi mo gagamitin ang link.",
  ],
  en: [
    "Someone requested access to the GFX Trading System and entered this address as their ACCM email.",
    "To confirm: open the link, log in with the Academy account that made the request, then press the confirm button. The link works once and expires after 24 hours.",
    "If this wasn't you, just ignore this email. Nothing happens unless the link is used.",
  ],
  button: "I-confirm ang ACCM email",
  buttonEn: "Confirm ACCM email",
  footer: "GFX Society · goldfx.society@gmail.com · Education lang, not financial advice.",
} as const;

/** Plain text + simple HTML. The only variable part is the pinned link (hex token, escaped anyway). */
export function buildAccmConfirmEmail(link: string): { subject: string; text: string; html: string } {
  const M = ACCM_CONFIRM_MAIL_COPY;
  const text = [M.tl[0], "", M.tl[1], "", link, "", M.tl[2], "", "---", "", M.en[0], "", M.en[1], "", link, "", M.en[2], "", "--", M.footer, ""].join("\n");
  const p = (s: string) => `<p style="margin:0 0 12px">${esc(s)}</p>`;
  // One button per language block (each block works on its own). Full width on mobile, max 320px, >= 44px tall.
  const btn = (label: string) =>
    `<p style="margin:16px 0"><a href="${esc(link)}" style="display:block;width:100%;max-width:320px;box-sizing:border-box;padding:12px 16px;min-height:44px;line-height:20px;font-size:16px;text-align:center;background:#111;color:#fff;text-decoration:none;border-radius:6px">${esc(label)}</a></p>`;
  const html =
    `<!doctype html><html><body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px">` +
    p(M.tl[0]) + p(M.tl[1]) + btn(M.button) + p(M.tl[2]) +
    `<hr style="border:0;border-top:1px solid #ddd;margin:20px 0">` +
    p(M.en[0]) + p(M.en[1]) + btn(M.buttonEn) + p(M.en[2]) +
    `<p style="margin:12px 0;font-size:12px;color:#555">${esc(link)}</p>` +
    `<p style="margin:20px 0 0;font-size:12px;color:#555">${esc(M.footer)}</p></body></html>`;
  return { subject: M.subject, text, html };
}

/** Issue a token for the caller's own awaiting request and mail the pinned link. Neutral result only. */
export async function sendAccmConfirm(deps: SendDeps): Promise<SendResult> {
  const log = deps.log ?? ((code: string) => console.error("[system/join] accm confirm mail", { code }));
  if (!deps.config) {
    log("smtp_env_missing");
    return "error";
  }
  let r: IssueResult;
  try {
    r = await deps.issueToken();
  } catch {
    r = null;
  }
  if (!r) {
    log("issue_failed");
    return "error";
  }
  if (r.error === "none") return "none";
  if (r.error === "rate_limited") return "rate_limited";
  if (typeof r.email !== "string" || typeof r.token !== "string" || !TOKEN_RE.test(r.token) || r.email.length > 254 || !ACCM_EMAIL_RE.test(r.email)) {
    log("issue_bad_shape");
    return "error";
  }
  const link = accmConfirmUrl(deps.siteUrl, r.token);
  const mail = buildAccmConfirmEmail(link);
  try {
    await deps.send({ from: deps.config.from, to: { name: "", address: r.email }, ...mail });
  } catch {
    log("smtp_send_failed");
    return "error";
  }
  return "sent";
}
