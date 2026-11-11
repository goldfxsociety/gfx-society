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
  // Logged out (Academy login reuse, 11 Nov). No email field, no allowlist check before login.
  loggedOutBody:
    "Log in muna gamit ang Academy account mo. Pagka-log in, i-tick ang email check para ma-verify ang membership mo.", // Design approved 11 Nov
  loginCta: "Log in with your Academy account", // Design approved 11 Nov
  signupPrompt: "Wala ka pang Academy account?", // Design approved 11 Nov
  signupLink: "Create a free account", // Design approved 11 Nov
  // Logged in, not yet a member.
  loggedInBody: "Isang step na lang: i-tick ang email check sa ibaba para ma-verify ang membership mo.", // Design approved 11 Nov
  // Consent text unchanged from the reviewed version (MEMBERS_CONSENT_VERSION stays "join-v2").
  consentLead: "Members-only ang GFX Trading System.",
  consentBody:
    "Para ma-verify ka, iche-check namin kung ang email mo ay naka-register sa ACCM sa ilalim ng IB line ng GFX Society. Email lang ang gagamitin namin para dito; hindi namin nakikita o sine-save ang balance, deposit, o trades mo. Walang minimum deposit para maging member.",
  consentCheckbox: "Pumapayag ako sa email check na ito.",
  privacyLink: "Privacy Policy",
  submit: "Verify membership", // Design approved 11 Nov
  academyLink: "Ituloy ang free Academy lessons", // existing string
  accmLink: "Tungkol sa ACCM", // [Builder] (tertiary link, no disclosure line per D3)
  consentRequired: "I-tick muna ang consent box para ma-check namin ang email mo.", // existing
  notVerified:
    "Hindi pa namin ma-verify ang membership mo. Members-only ito para sa mga ACCM client na naka-register sa ilalim ng GFX. Kung sa tingin mo mali ito, mag-email sa goldfx.society@gmail.com.", // Design review 2 Nov (no_match)
  notVerifiedAcademyLink: "Bumalik sa free Academy lessons", // Design review 2 Nov
  unverifiedEmail:
    "I-confirm muna ang email ng Academy account mo. Check your inbox (pati Spam o Promotions) para sa confirmation link, tapos subukan ulit.", // Design approved 11 Nov
  rateLimited: "Medyo marami nang tries. Please wait about an hour, tapos subukan ulit.", // Design approved 11 Nov (claim limit 5 per rolling hour)
  error: "May error sa pag-check. Try ulit mamaya, o mag-email sa goldfx.society@gmail.com.", // existing
} as const;

export const MEMBERS_COPY = {
  title: "Members area",
  body: "Verified member ka na. Dito ilalagay ang courses, market breakdowns, at community kapag ready na.", // [Builder] adapted: dropped "trade ideas for education"
  grace:
    "Hindi na namin ma-verify ang ACCM registration mo. Kung sa tingin mo mali ito, mag-email sa goldfx.society@gmail.com.", // Design review 2 Nov
} as const;
