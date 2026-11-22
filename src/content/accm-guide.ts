/**
 * /accm and /en/accm copy (simplicity spec v2 §3, Appendix C + H; Ben's decisions 12 Nov 2026).
 * PH strings are Taglish; EN strings are plain English, meaning identical. Same keys so one layout renders either.
 * EN strings not listed in Appendix H (registration steps, Discord helper, "not ready" link) are direct translations
 * of the existing PH lines, no new claims (approved by Design, PR #70 review, 15 Nov 2026).
 */
import { IB_DISCLOSURE_TEXT, IB_DISCLOSURE_TEXT_EN, NEUTRAL_LICENSING_TEXT } from "@/config/partners";

export type FaqItem = { q: string; a: string; /** Append the short IB disclosure (small) after the answer. */ ib?: boolean };

const PH_TITLE = "Start small, then join the Trading System";

type S = string;
export type AccmCopy = {
  lang: "fil" | "en"; path: S; joinHref: S; academyHref: S; brokerHref: S; brokerLink: S; title: S; description: S; back: S; eyebrow: S; h1: S; intro: S;
  ib: S; s1: S; notReady: S; s2: S; steps: { open: S; code: S; verify: S; kyc: S; kycNote: S }; s3: S; help: S;
  discordCta: S; discordPrep: S; discordNote: S; discordSoon: S; s4: S; faq: FaqItem[];
};

export const ACCM_COPY: AccmCopy = {
  lang: "fil",
  path: "/accm",
  joinHref: "/system/join",
  academyHref: "/academy",
  brokerHref: "/broker",
  brokerLink: "Choosing a broker →",
  title: PH_TITLE,
  description: "Step-by-step guide: start small sa cents account, max 1% risk, laging may stop loss. Education only.",
  back: "← Back to Academy",
  eyebrow: "Start small",
  h1: "Mag-start small, tapos join the Trading System",
  intro: "Para ito sa ready nang mag-start small with real money.",
  ib: IB_DISCLOSURE_TEXT,
  s1: "1. Quick self-check",
  notReady: "Hindi pa ready? Balik sa lessons →",
  s2: "2. Registration steps",
  steps: {
    open: "① Tap \"Open cents account\". Bubukas ang ACCM site sa cents signup.",
    code: "② Invitation code:",
    verify: "③ I-verify ang email o phone mo.",
    kyc: "④ KYC: Sundan ang KYC steps sa ACCM site.",
    kycNote: "Sa ACCM lang ang ID mo; hindi ito nakikita ng GFX.",
  },
  s3: "3. Pagka-register: join the Trading System",
  help: "May problema?",
  discordCta: "Universe Unlimited Discord →",
  discordPrep:
    "Ihanda ang ACCM User ID mo. Sa server, pumunta sa #verify. Huwag ibigay ang password, OTP, o ID documents mo.",
  discordNote:
    "Partner community ito ng GFX para sa live tools. Mag-deposit lang ng pera na kaya mong mawala, max 1% risk, laging may stop loss.",
  discordSoon: "Discord: coming soon.",
  s4: "4. FAQ",
  faq: [
    { q: "Kailangan ko ba ng ACCM account para sa Academy?", a: "Hindi. Libre ang Academy, kahit wala ka pang broker account." },
    {
      q: "Paano ako sasali sa Trading System?",
      a: "Pumunta sa Join the Trading System. Log in with your Academy account, i-tick ang email check, at i-verify ang membership mo. Kung ACCM client ka na under GFX o ng sub-IB nito, puwede kang mag-request doon.",
      ib: true,
    },
    {
      q: "Optional pa ba ang Universe Unlimited Discord?",
      a: "Oo, secondary lang. Join the Trading System muna. Universe Unlimited Discord ang partner community para sa live tools. Wala kaming Messenger.",
    },
    {
      q: "Naka-register ka na sa ACCM pero sa ibang IB?",
      a: "I-email ang ACCM from the email na naka-register mo sa ACCM. Ang template ay nasa \"May problema?\" sa Join the Trading System page, pagka-log in mo. To: csse@accmfx.com, roselle@accmfx.com. Subject: For Transfer IB. Huwag mag-open ng second account. Hindi namin ma-promise kung gaano katagal — naka-depende ito sa ACCM.",
      ib: true,
    },
    {
      q: "Magkano ang minimum deposit?",
      // Sprint 3 (explorer-linked-tiers-spec §2.3): ACCM funding facts moved into the app (after login).
      a: "Nasa app ang funding details after you log in. Start with a cents account, small money na kaya mong mawala, max 1% risk, laging may stop loss.",
    },
    { q: "Licensed ba ang ACCM?", a: NEUTRAL_LICENSING_TEXT },
    {
      q: "Ano ang cents account?",
      a: "Real-money account na naka-cents ang balance, kaya maliit ang taya habang natututo ka. Real pa rin ang losses.",
    },
    {
      q: "Kailangan ko ba ng demo?",
      a: "Hindi required. Optional ang free demo sa loob ng MT5 app kung gusto mo lang matutunan ang buttons.",
    },
    // "Paano mag-withdraw?" is hidden until the withdrawal info is confirmed.
    { q: "Guaranteed ba kikita?", a: "Hindi. Maraming traders ang natatalo. Start small, max 1% risk, laging may stop loss." },
  ],
};

export const ACCM_COPY_EN: AccmCopy = {
  lang: "en",
  path: "/en/accm",
  joinHref: "/en/system/join",
  academyHref: "/academy",
  brokerHref: "/en/broker",
  brokerLink: "Choosing a broker →",
  title: PH_TITLE,
  description: "Step-by-step guide: start small with a cents account, max 1% risk, always with a stop loss. Education only.",
  back: "← Back to Academy",
  eyebrow: "Start small",
  h1: "Start small, then join the Trading System",
  intro: "For people who are ready to start small with real money.",
  ib: IB_DISCLOSURE_TEXT_EN,
  s1: "1. Quick self-check",
  notReady: "Not ready yet? Back to the lessons →",
  s2: "2. Registration steps",
  steps: {
    open: "① Tap \"Open cents account\". The ACCM site opens on the cents signup.",
    code: "② Invitation code:",
    verify: "③ Verify your email or phone.",
    kyc: "④ KYC: Follow the KYC steps on the ACCM site.",
    kycNote: "Your ID stays with ACCM only; GFX can't see it.",
  },
  s3: "3. After you register: join the Trading System",
  help: "Having trouble?",
  discordCta: "Universe Unlimited Discord →",
  discordPrep:
    "Have your ACCM User ID ready. In the server, go to #verify. Never share your password, OTP, or ID documents.",
  discordNote:
    "This is GFX's partner community for live tools. Only deposit money you can afford to lose, max 1% risk, always with a stop loss.",
  discordSoon: "Discord: coming soon.",
  s4: "4. FAQ",
  faq: [
    { q: "Do I need an ACCM account for the Academy?", a: "No. The Academy is free, even if you don't have a broker account yet." },
    {
      q: "How do I join the Trading System?",
      a: "Go to Join the Trading System. Log in with your Academy account, tick the email check, and verify your membership. If you are already an ACCM client under GFX or one of its sub-IBs, you can request access there.",
      ib: true,
    },
    {
      q: "Is the Universe Unlimited Discord still available?",
      a: "Yes, as a secondary option. Join the Trading System first. Universe Unlimited Discord is the partner community for live tools. We don't use Messenger.",
    },
    {
      q: "Already with ACCM under a different IB?",
      a: "Email ACCM from the email registered with ACCM. The template is under \"Having trouble?\" on the Join the Trading System page, after you log in. To: csse@accmfx.com, roselle@accmfx.com. Subject: For Transfer IB. Don't open a second account. We can't promise how long the transfer will take — timing depends on ACCM.",
      ib: true,
    },
    {
      q: "What is the minimum deposit?",
      a: "Funding details are in the app after you log in. Start with a cents account, small money you can afford to lose, max 1% risk, always with a stop loss.",
    },
    { q: "Is ACCM licensed?", a: NEUTRAL_LICENSING_TEXT },
    {
      q: "What is a cents account?",
      a: "A real-money account with the balance in cents, so your stake stays small while you learn. Losses are still real.",
    },
    {
      q: "Do I need a demo?",
      a: "It isn't required. A free demo inside the MT5 app is optional if you just want to learn the buttons.",
    },
    { q: "Is profit guaranteed?", a: "No. Many traders lose money. Start small, max 1% risk, always with a stop loss." },
  ],
};

/** Self-check labels (SELF_CHECK in accm-self-check.tsx is the PH source). EN: simplicity spec Appendix H. */
export const SELF_CHECK_EN = [
  "I have finished the GFX Academy, or at least Level 6: Real-Money Discipline.",
  "I know the 1% rule, and I will always place a stop loss.",
  "I will only use money I can afford to lose, not money for bills, debt, or my emergency fund.",
  "I know there is no guaranteed profit, and I can lose.",
  "I have checked the broker myself: the licence for my country, fees and terms.",
];

export const SELF_CHECK_UI = {
  tl: {
    tickFirst: "I-tick muna ang 5 sa taas.",
    copied: "Copied! ✓",
    manual: "Long-press para i-copy",
  },
  en: {
    tickFirst: "Tick all 5 above first.",
    copied: "Copied! ✓",
    manual: "Long-press to copy",
  },
} as const;

/** id of the Discord step on /accm and /en/accm (the "May problema?" expander that holds the invite). */
export const ACCM_DISCORD_ID = "discord";
/**
 * Academy lesson help link (P3-13, lesson-risk-dedupe amendment): same label on every lesson, deep-links to the Discord
 * step on /accm (ACCM first, then Discord). /accm's own invite keeps ACCM_COPY.discordCta.
 */
export const LESSON_DISCORD_LINK = "Paano sumali sa Universe Unlimited Discord →";
export const LESSON_DISCORD_HREF = `/accm#${ACCM_DISCORD_ID}` as const;
