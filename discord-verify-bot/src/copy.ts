/**
 * All bot copy. Member-facing copy is balanced Taglish (roughly half English), education-only.
 * Rules: no income/profit/win-rate claims, no "guaranteed" results, VIP = community access (not results).
 * ACCM is the only accepted broker for VIP. Any MEMBER-facing message that names ACCM must include
 * IB_DISCLOSURE as one line (use withIb()). Enforced by test/payloads.test.ts.
 * Never mention the founder's real name.
 */
import type { LogFlag, ReasonCode, RequestStatus } from "./types";

export const CONTACT_EMAIL = "goldfx.society@gmail.com";
export const PRIVACY_URL = "https://gfx-society.vercel.app/privacy";

/** One-line IB disclosure (site line adapted to cover the partner community, balanced Taglish). */
export const IB_DISCLOSURE =
  "GFX at ang partner community ay maaaring kumita ng commission mula sa ACCM kapag nag-trade ka via our link.";

/** Appends the IB disclosure as its own (small) line whenever member copy names ACCM. */
export function withIb(text: string): string {
  if (!/ACCM/.test(text) || text.includes(IB_DISCLOSURE)) return text;
  return `${text}\n-# ${IB_DISCLOSURE}`;
}

/** What counts as a valid deposit (decided default). The bot does NOT auto-check any of this; admins judge. */
export const VALID_DEPOSIT_MEMBER =
  "Valid ang screenshot kung ACCM deposit ito, kita ang name o ACCM User ID mo, at dated within the last 30 days.";

/** Shown inside the upload modal, ABOVE the file field (and in the #verify panel). */
export const PRIVACY_NOTICE =
  "**Privacy:** Your screenshot is only for VIP verification. Admins lang ang makakakita nito, and the bot deletes it after the review. " +
  "Decision log lang ang itatago namin: your Discord ID, sino ang nag-review, the date and time, at ang resulta. Kept for 12 months, then auto-deleted. " +
  "Puwede mong takpan ang account number. " +
  `Questions: ${CONTACT_EMAIL} · Privacy Notice: ${PRIVACY_URL}`;

/** Text Display at the top of the upload modal: requirement + privacy + disclosure. */
export const MODAL_NOTICE = withIb(`${VALID_DEPOSIT_MEMBER}\n\n${PRIVACY_NOTICE}`);

export const MODAL_TITLE = "VIP deposit verification"; // ≤45
export const UPLOAD_LABEL = "ACCM deposit screenshot (1 image)"; // ≤45
export const UPLOAD_DESCRIPTION = "PNG, JPG o WEBP. Kita dapat ang name o ACCM User ID mo at ang date."; // ≤100

export const PANEL_TEXT = withIb(
  "**VIP verification** 🔐\n" +
    "Para makuha ang @VIP role (community access, not trading results), click **Verify deposit** or run `/verify-deposit`, then upload your ACCM deposit screenshot. " +
    `${VALID_DEPOSIT_MEMBER} Please don't post screenshots dito sa channel.\n` +
    "Reminder: education lang ang GFX, not financial advice. Walang guaranteed results.\n\n" +
    PRIVACY_NOTICE,
);
export const PANEL_BUTTON = "Verify deposit";

export const MSG = {
  // member-facing
  received: "Natanggap na! ✅ An admin will review your screenshot. Makakatanggap ka ng DM kapag tapos na ang review.",
  alreadyVip: "VIP ka na! 🙌 No need to submit again.",
  pending: "May pending request ka pa. Please wait for the review muna.",
  cooldown: "Please wait mga 10 minutes bago mag-submit ulit.",
  dailyCap: "You've reached 5 submissions in 24 hours. Paki-try ulit bukas.",
  wrongChannel: (verifyChannelId: string) => `Sa <#${verifyChannelId}> lang puwedeng mag-verify. Please use that channel.`,
  guildOnly: "This only works sa GFX Discord server.",
  noFile: "Walang na-upload na file. Please try again using /verify-deposit.",
  badFile: (maxMb: number) => `Images only (PNG, JPG o WEBP), 1 file, max ${maxMb} MB. Paki-try ulit.`,
  error: "Nagka-error, please try again.",
  statusNone: "Wala ka pang VIP verification request. Run /verify-deposit para mag-start.",
  // admin-facing
  notAdmin: "Admins lang (with the GFX admin role) ang puwedeng mag-decide dito.",
  notInApprovals: "Sa #vip-approvals lang puwedeng mag-decide.",
  selfDecision: "Hindi puwedeng i-decide ang sarili mong request. Ibang admin ang mag-review.",
  alreadyDecided: (adminId: string | null) =>
    adminId ? `Na-decide na ni <@${adminId}>.` : "Na-decide na o expired na ang request na ito.",
  notFound: "Hindi na makita ang request na ito (baka expired na).",
  hierarchy:
    "⚠️ Hindi ma-assign ang @VIP: ilipat ang bot role sa itaas ng @VIP (Server Settings → Roles), tapos i-click ulit ang Approve. Naka-pending pa rin ang request.",
  processing: "⏳ Processing…",
} as const;

export const APPROVE_DM =
  "Welcome sa VIP! ✅ Your deposit is verified, at naka-on na ang @VIP access mo sa GFX community.\n" +
  "Reminder: education lang ito, not financial advice. Start small, max 1% risk per trade, at laging may stop loss.";

export const REASONS: Record<ReasonCode, { label: string; dm: string }> = {
  unclear: { label: "Unclear / cropped", dm: "the screenshot is blurry o naka-crop" },
  wrong_screen: { label: "Wrong screen", dm: "hindi ito ang deposit screen" },
  not_accm: { label: "Not an ACCM deposit", dm: "hindi ito ACCM deposit" },
  too_old: { label: "Older than 30 days", dm: "the deposit is older than 30 days" },
  cant_confirm: { label: "Can't confirm deposit / name / ID", dm: "hindi namin ma-confirm ang deposit, name o ACCM User ID" },
  other: { label: "Other (see note)", dm: "other reason, see the admin's note" },
};

const RESUBMIT_HOWTO =
  "Please resubmit sa #verify using /verify-deposit: an ACCM deposit screenshot na kita ang name o ACCM User ID mo, dated within the last 30 days (puwede mong takpan ang account number).";

/** Admin note goes into the DM only. It is never stored or logged. */
export function sanitizeNote(note?: string): string {
  if (!note) return "";
  return note
    .replace(/[\r\n]+/g, " ")
    .replace(/@(everyone|here)/gi, "@\u200b$1")
    .replace(/<@[!&]?\d+>/g, "@user")
    .trim()
    .slice(0, 300);
}

export function rejectDm(reason: ReasonCode, note?: string): string {
  const clean = sanitizeNote(note);
  const lines = [`Hindi pa namin ma-verify ang screenshot mo (${REASONS[reason].dm}).`, RESUBMIT_HOWTO];
  if (clean) lines.push(`Note from the admin: ${clean}`);
  return withIb(lines.join("\n"));
}

export function needsInfoDm(note: string): string {
  const clean = sanitizeNote(note);
  const lines = [
    "Kailangan pa namin ng konting info para ma-verify ang VIP request mo. 📝",
    clean ? `Note from the admin: ${clean}` : "",
    `${RESUBMIT_HOWTO} Puwede kang mag-submit ulit right away.`,
  ].filter(Boolean);
  return withIb(lines.join("\n"));
}

/** Posted in #verify when DMs are closed. No details (decision is not revealed). */
export const dmFallback = (memberId: string) =>
  `<@${memberId}> may update sa VIP verification mo. Your DMs are closed, kaya please run \`/verify-status\` dito para makita ang result (ikaw lang ang makakakita).`;

export function statusText(status: RequestStatus, reason: ReasonCode | null): string {
  switch (status) {
    case "pending":
      return "⏳ Pending pa ang request mo. Please wait for the review.";
    case "approved":
      return "✅ Approved! Naka-on na ang @VIP access mo.";
    case "rejected":
      return withIb(`❌ Not verified yet${reason ? ` (${REASONS[reason].dm})` : ""}. ${RESUBMIT_HOWTO}`);
    case "needs_info":
      return withIb(`📝 An admin needs more info bago ma-verify ang request mo. ${RESUBMIT_HOWTO} Puwede kang mag-submit ulit right away.`);
    case "expired":
      return "⌛ Your request expired bago na-review. Please submit ulit using /verify-deposit.";
  }
}

// ---------- admin-facing (#vip-approvals, #vip-log) ----------

/** Approver guidance on every card (decided default). */
export const APPROVER_GUIDANCE =
  "**Valid deposit:** ACCM screenshot showing the member's name or ACCM User ID, dated within the last 30 days. Admins judge the amount. " +
  "⚠️ The bot does **not** auto-check any of this.";

export function approvalCardText(requestId: string, memberId: string, createdUnix: number): string {
  return (
    `🧾 **VIP verification request** \`${requestId}\`\n` +
    `Member: <@${memberId}> (\`${memberId}\`)\n` +
    `Submitted: <t:${createdUnix}:f>\n` +
    `${APPROVER_GUIDANCE}\n` +
    "-# Huwag i-save, i-download o i-forward ang screenshot. Buburahin ito ng bot after the decision."
  );
}

/** #vip-log alert, posted once per card when the bot can't delete an approval card (screenshot still there). */
export const cardDeleteAlert = (requestId: string, cardUrl: string) =>
  `⚠️ Hindi ma-delete ng bot ang approval card ng request \`${requestId}\` (nandoon pa ang screenshot). Paki-delete manually: ${cardUrl} · Auto-retry pa rin ang bot every hour.`;

/** One-line #vip-log mirror. Mentions plus ids, no usernames stored, no images, no amounts, no notes. */
export function logLine(p: {
  requestId: string;
  memberId: string;
  adminId: string | null;
  decision: RequestStatus;
  decidedAt: string;
  reason?: ReasonCode | null;
  flags?: LogFlag[];
}): string {
  // Mentions render names (allowed_mentions is empty, so nobody is pinged); raw ids stay for traceability.
  const unix = Math.floor(Date.parse(p.decidedAt) / 1000);
  const when = Number.isFinite(unix) ? `<t:${unix}:f>` : p.decidedAt;
  const admin = p.adminId ? `<@${p.adminId}> (\`${p.adminId}\`)` : "system";
  const parts = [`\`${p.requestId}\``, `member <@${p.memberId}> (\`${p.memberId}\`)`, `${p.decision} by ${admin}`, when];
  if (p.reason) parts.push(`reason ${p.reason}`);
  if (p.flags?.length) parts.push(p.flags.join(","));
  return parts.join(" · ");
}
