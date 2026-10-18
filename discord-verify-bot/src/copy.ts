/**
 * All member/admin-facing copy. Balanced Taglish, education-only.
 * Rules: no income/profit/win-rate claims, no "guaranteed" wording, VIP = community access (not results).
 * If any message names ACCM, it MUST also include IB_DISCLOSURE (enforced by test/copy.test.ts).
 * Never mention the founder's real name.
 */
import type { LogFlag, ReasonCode, RequestStatus } from "./types";

export const CONTACT_EMAIL = "goldfx.society@gmail.com";
export const PRIVACY_URL = "https://gfx-society.vercel.app/privacy";
export const IB_DISCLOSURE =
  "GFX may earn a commission from ACCM if you sign up through our link. You can use any broker you choose.";

/** Shown inside the upload modal, ABOVE the file field (and in the #verify panel). */
export const PRIVACY_NOTICE =
  "**Privacy:** Ang screenshot ay para lang sa VIP verification. Admins lang ang makakakita nito, at buburahin ito pagkatapos ng review. " +
  "Decision log lang ang itatago namin (Discord ID mo, sino ang nag-review, oras, at resulta). " +
  "Puwede mong takpan ang account number. " +
  `Questions: ${CONTACT_EMAIL} · Privacy Notice: ${PRIVACY_URL}`;

export const MODAL_TITLE = "VIP deposit verification"; // ≤45
export const UPLOAD_LABEL = "Deposit screenshot (image, 1 file)"; // ≤45
export const UPLOAD_DESCRIPTION = "PNG, JPG o WEBP. Kita dapat ang petsa at status ng deposit."; // ≤100

export const PANEL_TEXT =
  "**VIP verification** 🔐\n" +
  "Para makuha ang @VIP role (community access), i-click ang **Verify deposit** o i-run ang `/verify-deposit`, tapos i-upload ang deposit screenshot mo. " +
  "Huwag mag-post ng screenshot dito sa channel.\n" +
  "Paalala: education lang ang GFX, hindi financial advice. Walang guaranteed results.\n\n" +
  PRIVACY_NOTICE;
export const PANEL_BUTTON = "Verify deposit";

export const MSG = {
  received: "Natanggap na! ✅ Ire-review ng admin ang screenshot mo. Makakatanggap ka ng DM kapag tapos na ang review.",
  alreadyVip: "VIP ka na! 🙌 Wala ka nang kailangang i-submit.",
  pending: "May pending ka pa; hintayin muna ang review.",
  cooldown: "Paki-hintay muna ng mga 10 minuto bago mag-submit ulit.",
  dailyCap: "Naabot mo na ang 5 submissions sa loob ng 24 oras. Paki-try ulit bukas.",
  wrongChannel: (verifyChannelId: string) => `Sa <#${verifyChannelId}> lang puwedeng mag-verify.`,
  guildOnly: "Sa GFX server lang puwedeng gamitin ito.",
  noFile: "Walang na-upload na file. Paki-try ulit gamit ang /verify-deposit.",
  badFile: (maxMb: number) => `Image lang ang puwede (PNG, JPG o WEBP), 1 file, max ${maxMb} MB. Paki-try ulit.`,
  error: "Nagka-error, paki-try ulit.",
  notAdmin: "Admins lang ang puwedeng mag-approve.",
  notInApprovals: "Sa #vip-approvals lang puwedeng mag-decide.",
  selfDecision: "Hindi puwedeng i-decide ang sarili mong request. Ibang admin ang mag-review.",
  alreadyDecided: (adminId: string | null) =>
    adminId ? `Na-decide na ni <@${adminId}>.` : "Na-decide na o expired na ang request na ito.",
  notFound: "Hindi na makita ang request na ito (baka expired na).",
  hierarchy:
    "⚠️ Hindi ma-assign ang @VIP: ilipat ang bot role sa itaas ng @VIP (Server Settings → Roles), tapos i-click ulit ang Approve. Naka-pending pa rin ang request.",
  processing: "⏳ Processing…",
  statusNone: "Wala ka pang VIP verification request.",
} as const;

export const APPROVE_DM =
  "Welcome sa VIP! ✅ Na-verify na ang deposit mo at naka-on na ang @VIP access mo sa GFX community.\n" +
  "Reminder: education lang ito, hindi financial advice. Start small, max 1% risk per trade, laging may stop loss.";

export const REASONS: Record<ReasonCode, { label: string; dm: string }> = {
  unclear: { label: "Unclear / cropped", dm: "malabo o naka-crop ang screenshot" },
  wrong_screen: { label: "Wrong screen", dm: "hindi deposit screen ang na-upload" },
  cant_confirm: { label: "Can't confirm deposit", dm: "hindi makumpirma ang deposit sa screenshot" },
  other: { label: "Other (see note)", dm: "iba pang dahilan" },
};

export function rejectDm(reason: ReasonCode, note?: string): string {
  const base =
    `Hindi pa namin ma-verify ang screenshot mo (${REASONS[reason].dm}). ` +
    "Paki-resend sa #verify gamit ang /verify-deposit: kita dapat ang petsa at status ng deposit (puwede mong takpan ang account number).";
  const clean = sanitizeNote(note);
  return clean ? `${base}\nNote mula sa admin: ${clean}` : base;
}

/** Admin note goes into the DM only. It is never stored or logged. */
export function sanitizeNote(note?: string): string {
  if (!note) return "";
  return note
    .replace(/[\r\n]+/g, " ")
    .replace(/@(everyone|here)/gi, "@\u200b$1")
    .trim()
    .slice(0, 300);
}

/** Posted in #verify when DMs are closed. No details (approved or rejected is not revealed). */
export const dmFallback = (memberId: string) =>
  `<@${memberId}> may update sa VIP verification mo. Sarado ang DMs mo, kaya i-run ang \`/verify-status\` dito para makita ang resulta (ikaw lang ang makakakita).`;

export function statusText(status: RequestStatus, reason: ReasonCode | null): string {
  switch (status) {
    case "pending":
      return "⏳ Pending pa ang request mo. Hintayin muna ang review.";
    case "approved":
      return "✅ Approved! Naka-on na ang @VIP access mo.";
    case "rejected":
      return `❌ Hindi pa na-verify${reason ? ` (${REASONS[reason].dm})` : ""}. Paki-submit ulit gamit ang /verify-deposit.`;
    case "expired":
      return "⌛ Na-expire ang request mo bago na-review. Paki-submit ulit gamit ang /verify-deposit.";
  }
}

export function approvalCardText(requestId: string, memberId: string, createdUnix: number): string {
  return (
    `🧾 **VIP verification request** \`${requestId}\`\n` +
    `Member: <@${memberId}> (\`${memberId}\`)\n` +
    `Submitted: <t:${createdUnix}:f>\n` +
    "-# Huwag i-save, i-download o i-forward ang screenshot. Buburahin ito ng bot pagkatapos ng decision."
  );
}

/** One-line #vip-log mirror. Ids only, no usernames, no images, no amounts. */
export function logLine(p: {
  requestId: string;
  memberId: string;
  adminId: string | null;
  decision: RequestStatus;
  decidedAt: string;
  reason?: ReasonCode | null;
  flags?: LogFlag[];
}): string {
  const parts = [
    `\`${p.requestId}\``,
    `member ${p.memberId}`,
    `admin ${p.adminId ?? "system"}`,
    p.decision,
    p.decidedAt,
  ];
  if (p.reason) parts.push(`reason ${p.reason}`);
  if (p.flags?.length) parts.push(p.flags.join(","));
  return parts.join(" · ");
}
