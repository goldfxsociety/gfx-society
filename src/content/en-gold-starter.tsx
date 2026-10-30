// English Gold Starter Kit copy (Phase 1).
// Source: /workspace/gfx/design/global/english-starter-kit-spec.md §2 + §D (no-demo-first, relayed 30 Oct 2026).
// RISK_MODE selects the rendered variant. "no_demo" is live (Ben's no-demo-first rule since 18 Oct 2026).
// The "demo_first" strings are the spec's §2 defaults, kept unused pending Ben's Q2 confirmation:
// switching is a one-constant change below.
import type { Day } from "@/components/funnel/seven-day-checklist";

export const RISK_MODE: "no_demo" | "demo_first" = "no_demo";

export const TITLE = "Gold Basics Starter Kit (Free) | GoldFX Global";
export const DESCRIPTION =
  "A free 5-step start to understanding gold (XAUUSD): the basics, cents accounts, stop losses and the 1% rule. Education only.";

export const HERO = {
  eyebrow: "GoldFX Global · Free",
  h1: "Gold Basics Starter Kit",
  cta: "Start Day 1 →",
  micro: "About 20–30 minutes a day · Made for your phone",
};

export const PATH = [
  { level: "foundations", slug: "what-is-the-financial-market", title: "1. What Is the Financial Market?", desc: "Where prices come from, who the players are, and what XAUUSD means." },
  { level: "foundations", slug: "stocks-vs-forex-vs-gold", title: "2. Stocks vs Forex vs Gold", desc: "How they differ, and why gold moves fast." },
  { level: "elementary", slug: "cents-account-your-first-real-money-practice", title: "3. Cents Accounts: Your First Real-Money Practice", desc: "How to start small with real money so you can train your emotions." },
  { level: "highschool", slug: "stop-loss-and-take-profit", title: "4. Stop Loss and Take Profit", desc: "How to plan your exit before you enter." },
  { level: "highschool", slug: "position-sizing-and-lot-calculation", title: "5. Position Sizing: The 1% Rule", desc: "How to work out lot size so no more than 1% of your account is at risk per trade." },
];
export const LESSON_NOTE = "Lesson in Taglish for now";

const JOURNAL = (
  <>
    For each trade, journal: date and time · why you entered (1 sentence) · entry, stop loss, take profit · lot size
    and % risk · the result, and <strong>what you learned</strong>. Winning or losing doesn&apos;t matter. Did you follow
    your plan?
  </>
);

const DAY1: Day = {
  title: "Day 1: What is the market, really?",
  body: (
    <>
      Read Lesson 1 (What Is the Financial Market). Then write one sentence in a notebook or notes app:{" "}
      <em>&quot;XAUUSD is…&quot;</em> Come back to it on Day 7.
    </>
  ),
  href: "/academy/foundations/what-is-the-financial-market",
};
const DAY2: Day = {
  title: "Day 2: Why gold?",
  body: (
    <>
      Read Stocks vs Forex vs Gold. Write down 2 reasons gold often moves faster than many stocks. Remember: faster moves
      also mean faster losses without a plan.
    </>
  ),
  href: "/academy/foundations/stocks-vs-forex-vs-gold",
};
const DAY5: Day = {
  title: "Day 5: The 1% rule",
  body: (
    <>
      Read Position Sizing. Example only: on a $100 account, 1% is $1. Work out the lot size so that if your stop loss is
      hit, you lose only $1. Repeat with a different stop-loss distance.
    </>
  ),
  href: "/academy/highschool/position-sizing-and-lot-calculation",
};
const DAY7: Day = {
  title: "Day 7: Review",
  body: (
    <>
      Read your journal again. Answer: (1) Did I follow my stop loss and the 1% rule every time? (2) What is one thing
      I&apos;ll do differently next week? Write down your <em>process</em> (not your profit or loss).
    </>
  ),
};

// §D no-demo-first (rendered)
const DAY3_NO_DEMO: Day = {
  title: "Day 3: Meet the cents account",
  body: (
    <>
      Read the Cents Account lesson: a cents account uses real money, but in small amounts. Set a budget you can afford to
      lose. Optional: open an MT5 demo just to learn the buttons (find XAUUSD, the bid/ask price and the chart).
    </>
  ),
  href: "/academy/elementary/cents-account-your-first-real-money-practice",
};
const DAY4_NO_DEMO: Day = {
  title: "Day 4: Plan your exit before you enter",
  body: (
    <>
      Read Stop Loss and Take Profit. Before any trade, set your stop loss and take profit <strong>before</strong> you
      enter. Write down why you put your stop loss there.
    </>
  ),
  href: "/academy/highschool/stop-loss-and-take-profit",
};
const DAY6_NO_DEMO: Day = {
  title: "Day 6: Your first small trades + journal",
  body: (
    <>
      If you trade, place 1–3 small trades on a cents account using your plan (stop loss, max 1% risk), only with money you
      can afford to lose. {JOURNAL}
    </>
  ),
};

// §2 demo-first (UNUSED unless RISK_MODE = "demo_first")
const DAY3_DEMO_FIRST: Day = {
  title: "Day 3: Practice and meet the cents account",
  body: (
    <>
      Open a free MT5 demo account and find XAUUSD, the bid/ask price and the chart. Don&apos;t trade yet. Then read the
      Cents Account lesson: a cents account uses real money, but in small amounts. Set a budget you can afford to lose.
    </>
  ),
  href: DAY3_NO_DEMO.href,
};
const DAY4_DEMO_FIRST: Day = {
  title: "Day 4: Plan your exit before you enter",
  body: (
    <>
      Read Stop Loss and Take Profit. On your demo, practise placing an order with a stop loss and take profit{" "}
      <strong>before</strong> you enter. Write down why you put your stop loss there.
    </>
  ),
  href: DAY4_NO_DEMO.href,
};
const DAY6_DEMO_FIRST: Day = {
  title: "Day 6: Practice trades + journal",
  body: (
    <>
      Place 1–3 practice trades on your demo using your plan (stop loss, max 1% risk). If you later move to a cents
      account, use only money you can afford to lose. {JOURNAL}
    </>
  ),
};

export const RISK_LINE_EN_NO_DEMO =
  "If you trade, start small with a cents account, using only money you can afford to lose. Max 1% risk per trade, always with a stop loss.";
export const RISK_LINE_EN_DEMO_FIRST =
  "Practise on a demo first. If you then trade, you can start small with a cents account, using only money you can afford to lose. Max 1% risk per trade, always with a stop loss.";

const BOX_CENTS_NO_DEMO = (
  <>
    Start small with a cents account: real money, but small amounts you can afford to lose.{" "}
    <strong>Max 1% risk per trade, always with a stop loss.</strong>
  </>
);
const BOX_CENTS_DEMO_FIRST = (
  <>
    Practise on a demo first. Then, if you choose, start small with a cents account: real money, but small amounts.{" "}
    <strong>Max 1% risk per trade, always with a stop loss.</strong>
  </>
);

const FAQ_HOW_MUCH_NO_DEMO =
  "To learn: nothing, the lessons are free. If you trade, start with a cents account and a small amount you can afford to lose (each broker has its own minimum deposit), max 1% risk per trade, always with a stop loss.";
const FAQ_HOW_MUCH_DEMO_FIRST =
  "To learn: nothing, the lessons are free. To practise: a demo account is free. If you trade, a cents account with a small amount you can afford to lose (each broker has its own minimum deposit), max 1% risk per trade, always with a stop loss.";

const DISCLAIMER_NO_DEMO =
  "Trading involves a real risk of loss. GoldFX Global is an education project of GFX Society. Education only, not financial advice. If you trade, start small (e.g. a cents account), max 1% risk per trade, always with a stop loss.";
const DISCLAIMER_DEMO_FIRST =
  "Trading involves a real risk of loss. GoldFX Global is an education project of GFX Society. Education only, not financial advice. Practise on a demo first; if you trade, start small (e.g. a cents account), max 1% risk per trade, always with a stop loss.";

const demo = (RISK_MODE as string) === "demo_first";

export const DAYS: Day[] = [
  DAY1,
  DAY2,
  demo ? DAY3_DEMO_FIRST : DAY3_NO_DEMO,
  demo ? DAY4_DEMO_FIRST : DAY4_NO_DEMO,
  DAY5,
  demo ? DAY6_DEMO_FIRST : DAY6_NO_DEMO,
  DAY7,
];
export const RISK_LINE_EN = demo ? RISK_LINE_EN_DEMO_FIRST : RISK_LINE_EN_NO_DEMO;
export const BOX = {
  title: "🟡 Before your first real-money trade",
  items: [
    "Read the Stop Loss and Position Sizing lessons first, and write down your plan.",
    demo ? BOX_CENTS_DEMO_FIRST : BOX_CENTS_NO_DEMO,
    "Only use money you can afford to lose. Never use money for bills, debt or your emergency fund.",
    <>There are no shortcuts. If someone promises &quot;sure profit,&quot; that&apos;s a red flag.</>,
  ],
};
export const FAQ = [
  { q: "Is it really free?", a: "Yes. All the lessons and this checklist are free to read." },
  { q: "Do I need to sign up?", a: "No, not to read. Sign-up is optional if you want to save your progress (the sign-up pages are in Taglish for now)." },
  { q: "Where should I trade?", a: "We don't recommend any broker. Lesson 3 explains how cents accounts work, and you'll learn how to check a broker yourself, including whether it is licensed where you live." },
  { q: "Will I make money?", a: "There's no guarantee. Trading carries a real risk of loss. The goal here is to learn a good process and risk management." },
  { q: "How much do I need to start?", a: demo ? FAQ_HOW_MUCH_DEMO_FIRST : FAQ_HOW_MUCH_NO_DEMO },
  { q: "Is this available in my country?", a: "This page is education only and open to everyone. Trading rules are different in each country. Check your local law before you open any trading account." },
];
export const DISCLAIMER = demo ? DISCLAIMER_DEMO_FIRST : DISCLAIMER_NO_DEMO;
export const PRIVACY = "We don't collect personal information on this page. Privacy questions:";
