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
  underCta:
    "Members-only ito para sa mga registered sa ACCM sa ilalim ng IB line ng GFX. Bukas sa lahat ang free Academy lessons.",
  risk: "Max 1% risk per trade. Education lang, not financial advice.",
} as const;

/** /system "what's included" expander summary (P2.6 compact layout). */
export const SYSTEM_ROWS_SUMMARY = "Ano ang kasama?";

/** Short members-only hint before a gold Join click on Home (QA P3-6, Design "P3-6 for P2"). */
export const MEMBERS_ONLY_HINT = "Members-only ang Trading System.";

/** Consent version stored with member_status.consent_version. Bump when consent text changes. */
export const MEMBERS_CONSENT_VERSION = "join-v2";

export const JOIN_COPY = {
  title: "Join the Trading System", // simplicity spec v2 §3 / App. C (12 Nov)
  intro: "Mag-verify para ma-access ang courses, market breakdowns, at community.", // Addendum A
  // Logged out (Academy login reuse, 11 Nov). No email field, no allowlist check before login.
  loggedOutBody:
    "Log in muna gamit ang Academy account mo. Pagka-log in, i-tick ang email check para ma-verify ang membership mo.", // Design approved 11 Nov
  /** Logged-out one-line intro (simplicity spec App. C). loggedOutBody stays for reference / EN parity. */
  loggedOutIntro: "Log in with your Academy account para ma-verify ang membership mo.",
  loginCta: "Log in with your Academy account", // Design approved 11 Nov
  signupPrompt: "Wala ka pang account?", // simplicity spec App. C (12 Nov)
  signupLink: "Create a free account", // Design approved 11 Nov
  // Logged in, not yet a member.
  loggedInBody: "Isang step na lang: i-tick ang email check sa ibaba para ma-verify ang membership mo.", // Design approved 11 Nov
  // Consent text unchanged from the reviewed version (MEMBERS_CONSENT_VERSION stays "join-v2").
  consentLead: "Members-only ang GFX Trading System.",
  consentBody:
    "Para ma-verify ka, iche-check namin kung ang email mo ay naka-register sa ACCM sa ilalim ng IB line ng GFX Society. Email lang ang gagamitin namin para dito; hindi namin nakikita o sine-save ang balance, deposit, o trades mo. Walang minimum deposit para maging member.",
  consentCheckbox: "Pumapayag ako sa email check na ito.",
  privacyLink: "Privacy Policy",
  submit: "I-link ang ACCM account mo", // Sprint 3 (explorer-linked-tiers-spec §3): join gold when they came to link
  /** Sprint 3: consent submit when `next` is Gold Reset, and the outline after no_match / pending (spec §2.2, §3). */
  continueGoldReset: "Ituloy ang Gold Reset",
  academyLink: "Ituloy ang free Academy lessons", // existing string
  accmLink: "Tungkol sa ACCM", // [Builder] (tertiary link, no disclosure line per D3)
  helpSummary: "May problema?", // simplicity spec §2 / App. C: muted help grouped under one expander
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

/**
 * /en/system/join (simplicity spec v2, Appendix H): meaning identical to JOIN_COPY. loginCta and signupLink
 * were already English in PH and are reused verbatim (submit is Taglish in PH since Sprint 3). Same keys as JOIN_COPY so the same components render either.
 */
export const JOIN_COPY_EN = {
  title: "Join the Trading System",
  intro: "Verify to access the courses, market breakdowns, and community.",
  loggedOutIntro: "Log in with your Academy account to verify your membership.",
  loggedOutBody: "Log in first with your Academy account. After you log in, tick the email check to verify your membership.",
  loginCta: JOIN_COPY.loginCta,
  signupPrompt: "Don't have an Academy account yet?",
  signupLink: JOIN_COPY.signupLink,
  loggedInBody: "One step left: tick the email check below to verify your membership.",
  consentLead: "The GFX Trading System is members-only.",
  consentBody:
    "To verify you, we will check whether your email is registered with ACCM under the GFX Society IB line. We only use the email for this; we cannot see or save your balance, deposits, or trades. There is no minimum deposit to become a member.",
  consentCheckbox: "I agree to this email check.",
  privacyLink: "Privacy Policy",
  submit: "Link your ACCM account",
  continueGoldReset: "Continue Gold Reset",
  academyLink: "Continue with the free Academy lessons",
  accmLink: "About ACCM",
  helpSummary: "Having trouble?",
  consentRequired: "Tick the consent box first so we can check your email.",
  notVerified:
    "We couldn't verify your membership yet. This is members-only for ACCM clients registered under GFX. If you think this is wrong, email goldfx.society@gmail.com.",
  notVerifiedAcademyLink: "Back to the free Academy lessons",
  unverifiedEmail:
    "Confirm your Academy account email first. Check your inbox (including Spam or Promotions) for the confirmation link, then try again.",
  rateLimited: "Too many tries. Please wait about an hour, then try again.",
  error: "There was an error checking this. Try again later, or email goldfx.society@gmail.com.",
} as const satisfies Record<keyof typeof JOIN_COPY, string>;

export type JoinCopy = Record<keyof typeof JOIN_COPY, string>;

/** SYSTEM_COPY.underCta in English (simplicity spec Appendix H, meaning identical). */
export const SYSTEM_UNDER_CTA_EN =
  "This is members-only for people registered with ACCM under GFX's IB line. The free Academy lessons are open to everyone.";
