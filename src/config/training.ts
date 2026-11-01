/**
 * Slice 2 (courses + GCash payments) fixed copy and flags. Render from here, never per page.
 * Members area: NO IB/commission line (Addendum D3, Ben via Jarvis + Design, 2 Nov; Ben's OK at PR review).
 */

export const RISK_LINE = "Max 1% risk per trade. Education lang, not financial advice.";
export const RISK_LINK_TEXT = "Basahin ang full risk disclosure →";
export const STATUS_SURFACE_NOTE = "Wala pa kaming email updates. Check this page for updates sa payment mo.";
export const APPROVAL_TIME = "1–2 days";
export const CONTACT_EMAIL = "goldfx.society@gmail.com";

/** Ben, 2 Nov: "Non refundable tayo para seryosohin talaga nila." (Addendum D1) */
export const REFUND_COPY = {
  tl: "Non-refundable. Pakisigurado bago magbayad.",
  en: "Non-refundable. Please be sure before paying.",
} as const;

/** B12/B-AC6: Buy ships only when refund copy is filled in. */
export const BUY_ENABLED = REFUND_COPY.tl.trim().length > 0;

/** B6: ideas + chat ship in slices 3–4. */
export const COMING_LATER_NOTE = "(Live Market Breakdowns at chat: coming in a later update.)";
export const INCLUDED_NOTE = "Paid courses: one-time payment, walang monthly fee. Kasama lang ang nakalista sa bawat course.";

/** Design, 2 Nov (QA P2): optional muted note under the inclusions list; never next to the price or Pay. */
export const COMING_LATER_COURSE_NOTE =
  "Paparating pa: Market Breakdowns at member chat para sa verified members. Hindi ito kasama sa presyo ng course na ito.";

export const peso = (n: number) => `₱${Number(n).toLocaleString("en-PH")}`;
/** Short refund form for /courses cards (Design, 2 Nov). Full REFUND_COPY stays on /pay and the course page. */
export const cardPriceLine = (pricePhp: number) => `${peso(pricePhp)} · one-time · Non-refundable`;

export const PLACEMENT_PASS_PCT = 80;
export const PLACEMENT_COOLDOWN_HOURS = 24;

export type CatalogCourse = {
  slug: string;
  title: string;
  priceLine: string;
  forWho: string;
  included: string[];
  modules: string[];
  prereqSlug?: string;
  lockLine?: string;
};

/** Static catalog text (from the outline via Design spec §1.2). Access/state always come from the DB. */
export const CATALOG: CatalogCourse[] = [
  {
    slug: "gold-reset",
    title: "Gold Reset",
    priceLine: "FREE para sa verified members",
    forWho: "Para sa dating traders na gustong bumalik nang may disiplina.",
    included: ["4 short lessons + Reset Checklist", "Quiz at practice tasks", "Progress tracking"],
    modules: ["Gold Reset"],
  },
  {
    slug: "gold-strategy-basics",
    title: "Gold Strategy Basics",
    priceLine: "₱2,000 · one-time",
    forWho: "Basahin ang Gold chart gamit ang H4/H1 at mag-plan bago pumasok.",
    included: [
      "5 modules: Market Structure, Supply and Demand, EMA Pullback (20/50), Fibonacci, Trade Management",
      "Lessons with a quiz per lesson",
      "Capstone self-check: 3 complete trade plans",
      "Pag-unlock ng Gold Advanced Setups",
    ],
    modules: ["Market Structure", "Supply and Demand", "EMA Pullback (20/50)", "Fibonacci", "Trade Management"],
  },
  {
    slug: "gold-advanced-setups",
    title: "Gold Advanced Setups",
    priceLine: "₱2,000 · one-time",
    forWho: "Session at liquidity setups para sa London at NY, kasama ang news discipline.",
    included: [
      "6 modules: SMC and ICT Concepts, ORB, First Candle Theory, Asian Range Breakout, Session Liquidity Sweep, News Trading Discipline",
      "Lessons with a quiz per lesson",
      "Capstone self-check: session playbook",
    ],
    modules: [
      "SMC and ICT Concepts",
      "ORB",
      "First Candle Theory",
      "Asian Range Breakout",
      "Session Liquidity Sweep",
      "News Trading Discipline",
    ],
    prereqSlug: "gold-strategy-basics",
    lockLine: "Kailangan munang tapusin ang Gold Strategy Basics o pumasa sa placement quiz.",
  },
];

export const REJECT_REASONS = [
  "Hindi tugma ang amount sa course price.",
  "Hindi malinaw o hindi mabasa ang receipt.",
  "Hindi namin makita ang bayad sa GCash history.",
  "Kulang o mali ang GFX reference code sa GCash message.",
  "Nagamit na ang receipt o ref no. sa ibang purchase.",
] as const;

export const FLAG_COPY: Record<string, { label: string; explain: string }> = {
  amount_mismatch: {
    label: "Amount mismatch",
    explain: "Ang amount na nilagay ng member ay iba sa course price. Check sa GCash history kung magkano talaga ang natanggap.",
  },
  duplicate_ref: {
    label: "Duplicate ref",
    explain: "Ang GCash Ref No. na ito ay nagamit na sa ibang purchase. Puwedeng typo o reused receipt.",
  },
  duplicate_image: {
    label: "Duplicate image",
    explain: "Parehong-pareho ang receipt image sa ibang purchase. Puwedeng na-upload ulit ang lumang receipt.",
  },
  check_format: {
    label: "Ref format",
    explain: "Hindi 13 digits ang GCash Ref No. Check ang receipt image.",
  },
};

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const QR_URL_TTL_SECONDS = 300;
export const RECEIPT_URL_TTL_SECONDS = 60;
