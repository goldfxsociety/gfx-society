/**
 * Copy for the GFX Trading System members gate. PH page = Taglish.
 * /system and the join intro: GFX Design Addendum A (verbatim). Join flow: Design Addendum C
 * (verbatim where given). No IB/commission line in the members area (Ben via Jarvis, 2 Nov; Design D3).
 * Strings marked [Builder] were written by the builder and need a Design check.
 */
export const SYSTEM_COPY = {
  title: "Matuto ng Gold trading, step by step.",
  intro:
    "Ang GFX Trading System ay members-only na learning space: structured courses, chart breakdowns na may paliwanag, at community kung saan sabay-sabay tayong natututo.",
  rows: [
    { title: "Courses", body: "Mula basics hanggang trade plan mo, sa sarili mong oras." },
    {
      title: "Market breakdowns",
      body: "Paano binabasa ang Gold chart sa London at New York session: ang reasoning, ang invalidation, at ang stop loss. Para matutunan mo ang proseso, hindi para kopyahin.",
    },
    { title: "Community", body: "Magtanong, mag-share ng natutunan, at matuto kasama ng ibang members." },
  ],
  joinCta: "Join as member",
  underCta:
    "Members-only ito para sa mga registered sa ACCM sa ilalim ng IB line ng GFX. Bukas sa lahat ang free Academy lessons.",
  risk: "Max 1% risk per trade. Education lang, not financial advice.",
} as const;

/** Consent version stored with member_status.consent_version. Bump when consent text changes. */
export const MEMBERS_CONSENT_VERSION = "join-v2";

export const JOIN_COPY = {
  title: "Join the GFX Trading System", // existing
  intro: "Mag-verify para ma-access ang courses, market breakdowns, at community.", // Addendum A
  emailLabel: "Email na ginamit mo sa ACCM registration", // [Builder]
  // Consent text unchanged from the reviewed version.
  consentLead: "Members-only ang GFX Trading System.",
  consentBody:
    "Para ma-verify ka, iche-check namin kung ang email mo ay naka-register sa ACCM sa ilalim ng IB line ng GFX Society. Email lang ang gagamitin namin para dito; hindi namin nakikita o sine-save ang balance, deposit, o trades mo. Walang minimum deposit para maging member.",
  consentCheckbox: "Pumapayag ako sa email check na ito.",
  privacyLink: "Privacy Policy",
  sendCode: "Send code", // Addendum C
  sent: "Kung naka-register ang email na ito bilang GFX member, may darating na 6-digit code sa inbox mo within a few minutes. Check din ang Spam/Promotions.", // Addendum C
  noCodeToggle: "Walang dumating na code?", // Addendum C
  noCodeBody:
    "Siguraduhing ito ang email na ginamit mo sa ACCM registration. Monthly ina-update ang member list, kaya kung bago ka lang nag-register, subukan ulit mamaya o mag-email sa goldfx.society@gmail.com.", // Addendum C
  resend: "Resend code", // Addendum C
  resendIn: (s: number) => `Puwede ulit mag-resend in ${s}s`, // [Builder]
  codeLabel: "6-digit code", // [Builder]
  verify: "I-verify", // [Builder]
  wrongCode: "Mali ang code. Subukan ulit.", // Addendum C
  expiredCode: "Expired na ang code. Mag-request ng bago.", // Addendum C
  otherEmail: "Ibang email", // [Builder]
  academyLink: "Ituloy ang free Academy lessons", // existing string
  accmLink: "Tungkol sa ACCM", // [Builder] (tertiary link, no disclosure line per D3)
  consentRequired: "I-tick muna ang consent box para ma-check namin ang email mo.", // existing
  invalidEmail: "Pakilagay ang tamang email address.", // [Builder]
  notVerified:
    "Hindi pa namin ma-verify ang membership mo. Members-only ito para sa mga registered sa ACCM sa ilalim ng IB line ng GFX.", // [Builder] after a valid code but not listed / no OTP session
  error: "May error sa pag-check. Try ulit mamaya, o mag-email sa goldfx.society@gmail.com.", // existing
} as const;

export const MEMBERS_COPY = {
  title: "Members area",
  body: "Verified member ka na. Dito ilalagay ang courses, market breakdowns, at community kapag ready na.", // [Builder] adapted: dropped "trade ideas for education"
  grace:
    "Hindi na namin ma-verify ang ACCM registration mo, contact us kung mali: goldfx.society@gmail.com",
} as const;
