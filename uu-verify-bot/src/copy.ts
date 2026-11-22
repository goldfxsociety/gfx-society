/**
 * Member-facing copy. The SPEC_* blocks are verbatim from /workspace/uu/design/onboarding-spec.md §10
 * (balanced Taglish). Do not edit them here without a spec change. Everything else is short system copy.
 * Never use performance / income / win-rate claims.
 */

// ── §10 verbatim ────────────────────────────────────────────────────────────
export const SPEC_START_HERE = `Welcome sa Universe Unlimited.

Para makapasok, registered at verified ka dapat sa ACCM, under kay Coach Mike o sa sub-IB line niya.

Next step: pumunta sa #verify. I-tap ang Client ako kung client ka, o IB ako kung IB ka.`;

export const SPEC_CLIENT_AKO = `I-tap ang Client ako, tapos ihanda:

• ACCM User ID mo (6 digits)
• Screenshot ng verified status mo (pwede mong i-crop o itago ang ibang details)
• Piliin ang direct referring IB mo sa dropdown. Discord display name lang ang makikita.

Iche-check ito ng IB mo sa sarili niyang portal. Hintayin ang DM para sa result.`;

export const SPEC_IB_AKO = `I-tap ang IB ako, tapos ihanda:

• ACCM IB email mo
• Piliin ang upline IB mo sa dropdown. Discord display name lang ang makikita.

Iche-check ito ng upline mo. Kapag na-approve, gagawa ang bot ng line mo at lalabas ka sa client dropdown.`;

export const SPEC_FREE_APPROVED = `Approved ka na — FREE role mo na ito.

Pwede mo nang pasukin ang education at community channels.

Kung may deposit ka na na $50 o more, pwede kang mag-apply para sa VIP.`;

export const SPEC_VIP_APPROVED = `VIP ka na. Bukas na sa'yo ang pro indicator at AI signals.

Education lang ito, not financial advice. Max 1% risk per trade.`;

export const SPEC_IB_APPROVED_NEW = `Approved ka na bilang IB. May Sub-IB role ka na, at may sarili ka nang review channel para sa clients mo. Lalabas ka na sa client dropdown.

May FREE role ka na rin. Kung may deposit ka na na $50 o more, pwede kang mag-apply para sa VIP.`;

export const SPEC_IB_APPROVED_FROM_CLIENT = `Approved ka na bilang IB. May Sub-IB role ka na, at may sarili ka nang review channel para sa clients mo. Lalabas ka na sa client dropdown.

FREE o VIP role mo ay pareho pa rin. Kung VIP ka, kasama ka pa rin sa monthly re-check.`;

export const SPEC_DENIED = `Hindi na-approve ang verification mo.

Dahilan: [reason]

Pwede kang mag-submit ulit kapag ready na.`;

export const SPEC_REMINDER = `Paalala: sa 1st ng susunod na buwan, babalik sa FREE ang lahat ng VIP roles.

Kung gusto mong manatiling VIP, mag-reverify bago mag-1st. Screenshot lang na $50 o more ang deposit o balance mo. Pwede mong i-crop ang ibang details.`;

export const SPEC_RESET_DAY = `Nag-reset na ang VIP roles para sa buwang ito. Naka-FREE ka ulit.

Mag-reverify para maibalik ang VIP.`;

export const SPEC_TRANSFER = `Hindi ka pa under sa tree ni Coach Mike, kaya hindi ka pa makakapasok sa community.

Para makasali, mag-transfer ka under sa GFX line. I-email sa csse@accmfx.com at roselle@accmfx.com, subject: For Transfer IB. IB email: goldfx.society@gmail.com.

Kapag complete na ang transfer, bumalik sa #verify at piliin ang GFX line.`;

export const SPEC_WRONG_IB = `Hindi ito ang tamang referring IB. I-submit ulit at piliin ang tamang IB sa dropdown.`;

export const SPEC_RISK_LINE = `Education lang, not financial advice. Max 1% risk per trade.`;

/** Fill the Denied DM. Admins replace [reason] before a denial is sent. */
export const deniedDm = (reason: string) => SPEC_DENIED.replace("[reason]", reason.trim());

// ── Privacy notice (spec §11 asks for it; wording is ours — needs Design sign-off) ──
export const PRIVACY_NOTICE =
  "Privacy: Ang referring IB mo lang ang makakakita ng proof mo (at ang upline niya hanggang kay Coach Mike kung ma-escalate). Admins lang ang makakakita ng IB email. Buburahin ang screenshot pagkatapos ng decision. Huwag mag-send ng full account statement.";

// ── Panels ──────────────────────────────────────────────────────────────────
export const START_HERE_PANEL = `${SPEC_START_HERE}\n\n${PRIVACY_NOTICE}`;
export const VERIFY_PANEL = `${SPEC_CLIENT_AKO}\n\n${SPEC_IB_AKO}\n\n${PRIVACY_NOTICE}`;
export const BTN_CLIENT = "Client ako";
export const BTN_IB = "IB ako";

// ── Dropdown ────────────────────────────────────────────────────────────────
export const TRANSFER_OPTION_LABEL = "Wala sa list / ibang IB (not under Coach Mike)";
export const TRANSFER_OPTION_VALUE = "other";

// ── Deny reasons (rendered into [reason], except not_tree which sends the Transfer route copy) ──
export const DENY_LABELS: Record<string, string> = {
  wrong_ib: "Wrong referring IB",
  wrong_upline: "Wrong upline IB",
  not_tree: "Not under Coach Mike's tree",
  unclear: "Unclear screenshot",
  below_min: "Below $50 minimum (VIP)",
  duplicate: "Duplicate User ID",
  duplicate_email: "Duplicate IB email",
  other: "Other",
};

export function denyReasonText(code: string, type: "free" | "vip" | "ib", note?: string): string {
  switch (code) {
    case "wrong_ib":
      return SPEC_WRONG_IB;
    case "wrong_upline":
      return "Hindi ito ang tamang upline IB. I-submit ulit at piliin ang tamang upline sa dropdown.";
    case "unclear":
      return type === "vip"
        ? "Hindi malinaw ang screenshot. Mag-submit ulit ng mas malinaw na crop na kita pa rin na $50 o more ang deposit o balance mo."
        : "Hindi malinaw ang screenshot. Mag-submit ulit ng mas malinaw na crop na kita pa rin ang verified status mo.";
    case "below_min":
      return "Hindi pa umaabot sa $50 minimum ang deposit o balance na nakita sa screenshot.";
    case "duplicate":
      return "Nagamit na ang ACCM User ID na ito ng ibang Discord account. Kailangan muna itong i-review ng admin.";
    case "duplicate_email":
      return "May IB line na gamit ang ACCM IB email na ito. Kailangan muna itong i-review ng admin.";
    default:
      return (note ?? "").trim();
  }
}

// ── Modal labels ────────────────────────────────────────────────────────────
export const MODAL = {
  clientTitle: "Client ako",
  ibTitle: "IB ako",
  accmLabel: "ACCM User ID",
  accmDesc: "6 digits",
  typeLabel: "Request type",
  typeFreeLabel: "FREE (registered at verified sa ACCM)",
  typeVipLabel: "VIP ($50 o more na deposit o balance)",
  typeFreeOnlyDesc: "FREE muna bago VIP.",
  lineLabel: "Referring IB",
  lineDesc: "Discord display name lang ang makikita.",
  shotLabel: "Screenshot",
  shotDescFree: "Verified status mo. Pwede mong i-crop ang ibang details.",
  shotDescVip: "$50 o more na deposit o balance. Pwede mong i-crop ang ibang details.",
  emailLabel: "ACCM IB email",
  uplineLabel: "Upline IB",
  denyTitle: "Deny",
  denyReasonLabel: "Reason",
  denyNoteLabel: "Reason (para sa Other)",
  denyNoteDesc: "Kasama sa DM. Huwag maglagay ng amount o account details.",
} as const;

// ── Ephemeral system messages (short; one next step) ────────────────────────
export const MSG = {
  guildOnly: "Sa Universe Unlimited server lang ito gumagana.",
  wrongChannel: (ch: string) => `Gamitin ito sa <#${ch}>.`,
  error: "May error. Subukan ulit mamaya.",
  pending: "May pending ka pang application. Hintayin ang DM para sa result.",
  dailyCap: "Naabot mo na ang limit ngayong araw. Subukan ulit bukas.",
  alreadyVip: "VIP ka na. Pwede kang mag-reverify sa huling 7 araw bago mag-1st.",
  alreadyFree: "FREE ka na. Para sa VIP, piliin ang VIP sa Request type.",
  freeFirst: "FREE muna bago VIP. Piliin ang FREE sa Request type.",
  badUserId: "Ang ACCM User ID ay 6 digits. Subukan ulit.",
  badEmail: "Hindi valid ang ACCM IB email. Subukan ulit.",
  noFile: "Kailangan ng screenshot. Subukan ulit.",
  badFile: (mb: number) => `PNG, JPG o WEBP lang, hanggang ${mb} MB. Subukan ulit.`,
  pickLine: "Piliin ang IB mo sa dropdown. Subukan ulit.",
  lineGone: "Hindi na available ang IB na pinili mo. Subukan ulit.",
  tooManyLinesClient: "Marami nang IB sa list. I-type ang /verify-client at hanapin ang IB mo.",
  tooManyLinesIb: "Marami nang IB sa list. I-type ang /verify-ib at hanapin ang upline mo.",
  alreadyIb: "May IB line ka na.",
  received: "Na-receive na ang application mo. Hintayin ang DM para sa result.",
  statusNone: "Wala ka pang application. Pumunta sa #verify.",
  statusPending: "Pending pa ang application mo. Hintayin ang DM para sa result.",
  statusApproved: "Approved ang huling application mo.",
  // Reviewer-facing
  notReviewer: "Hindi ikaw ang reviewer ng application na ito.",
  notAdmin: "Admin / Mod lang ang pwede dito.",
  selfDecision: "Hindi mo pwedeng i-decide ang sarili mong application.",
  alreadyDecided: "Na-decide na ang application na ito.",
  staleCard: "Lumipat na ang application na ito sa ibang review channel.",
  notFound: "Hindi makita ang application na ito.",
  needAdminDupUserId: "Duplicate ACCM User ID: Admin / Mod muna ang mag-review bago i-approve.",
  dupEmailBlocked: "Duplicate ACCM IB email: hindi gagawa ng pangalawang line. Admin: ayusin muna nang manual, o i-Deny.",
  otherNeedsNote: "Para sa Other, ilagay ang reason.",
  roleFailed: "Hindi ma-assign ang role (check bot permissions at role order). Hindi pa na-decide; subukan ulit.",
  memberLeft: "Wala na sa server ang member. Sinara ang application.",
  done: "Done.",
  noEmail: "Walang IB email sa application na ito.",
} as const;

/** Posted in #verify when a member's DMs are closed (no details, only a pointer). */
export const dmFallback = (userId: string) =>
  `<@${userId}> may update sa application mo, pero sarado ang DMs mo. I-type ang /uu-status para makita ang result.`;
