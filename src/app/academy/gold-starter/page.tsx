import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/server";
import { FIRST_LESSON_PATH } from "@/config/academy";
import { NextStepLink } from "@/components/funnel/next-step-link";
import { FirstTouch } from "@/components/funnel/first-touch";
import { SevenDayChecklist, type Day } from "@/components/funnel/seven-day-checklist";

// Copy: /workspace/gfx-funnel/drafts/01 + 04 (founder-approved). Broker-neutral:
// no broker names, logos or partner links on this page (spec 08).
const TITLE = "Gold Basics Starter Kit (Free) | GFX Society Academy";
const DESCRIPTION =
  "Libreng 5-step na simula sa Gold (XAUUSD) trading para sa mga Pinoy: basics, cents account, stop loss, at ang 1% rule. Education only.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/academy/gold-starter" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/academy/gold-starter", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const revalidate = 3600;

const RISK_LINE =
  "Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.";

const PATH = [
  {
    level: "foundations",
    slug: "what-is-the-financial-market",
    title: "1. Ano ang Financial Market? (Lesson 1)",
    desc: "Saan nanggagaling ang presyo, sino ang mga player, at ano ang ibig sabihin ng XAUUSD.",
  },
  {
    level: "foundations",
    slug: "stocks-vs-forex-vs-gold",
    title: "2. Stocks vs Forex vs Gold",
    desc: "Ano ang pinagkaiba nila, at bakit mabilis gumalaw ang Gold.",
  },
  {
    level: "elementary",
    slug: "cents-account-your-first-real-money-practice",
    title: "3. Cents Account: Ang Unang Real-Money Practice Mo",
    desc: "Paano mag-start small with real money para ma-train ang emotions mo.",
  },
  {
    level: "highschool",
    slug: "stop-loss-and-take-profit",
    title: "4. Stop Loss at Take Profit",
    desc: "Paano i-plan ang labasan mo bago ka pumasok.",
  },
  {
    level: "highschool",
    slug: "position-sizing-and-lot-calculation",
    title: "5. Position Sizing: Ang 1% Rule",
    desc: "Paano kalkulahin ang lot size para max 1% lang ng account ang naka-risk bawat trade.",
  },
];

const DAYS: Day[] = [
  {
    title: "Day 1: Ano ba talaga ang market?",
    body: (
      <>
        Basahin ang Lesson 1 (What is the Financial Market). Pagkatapos, isulat sa notebook o notes app sa 1
        sentence: <em>&quot;Ang XAUUSD ay…&quot;</em> Balikan mo ito sa Day 7.
      </>
    ),
    href: "/academy/foundations/what-is-the-financial-market",
  },
  {
    title: "Day 2: Bakit Gold?",
    body: (
      <>
        Basahin ang Stocks vs Forex vs Gold. Isulat ang 2 dahilan kung bakit mas mabilis gumalaw ang Gold kaysa
        maraming stocks. Tandaan: mas mabilis na galaw = mas mabilis ding talo kapag walang plan.
      </>
    ),
    href: "/academy/foundations/stocks-vs-forex-vs-gold",
  },
  {
    title: "Day 3: Kilalanin ang cents account",
    body: (
      <>
        Basahin ang Cents Account lesson. Alamin kung paano gumagana ang <strong>cents account</strong> (real money pero maliit lang) at mag-set ng budget na kaya mong mawala. Optional: buksan ang MT5 demo para lang ma-explore ang buttons, at hanapin ang XAUUSD, bid/ask at chart. Huwag munang mag-trade.
      </>
    ),
    href: "/academy/elementary/cents-account-your-first-real-money-practice",
  },
  {
    title: "Day 4: Plan ang labasan bago pumasok",
    body: (
      <>
        Basahin ang Stop Loss at Take Profit. Sa MT5, alamin kung paano maglagay ng order na may stop loss at take profit <strong>bago</strong> pumasok (puwede sa optional demo, para sa buttons lang). Isulat kung bakit doon mo inilagay ang SL.
      </>
    ),
    href: "/academy/highschool/stop-loss-and-take-profit",
  },
  {
    title: "Day 5: Ang 1% rule",
    body: (
      <>
        Basahin ang Position Sizing. Gamit ang hypothetical na $100 account: ang 1% ay $1. Kalkulahin ang lot size
        para kung tamaan ang SL mo, $1 lang ang talo. Ulitin gamit ang ibang SL distance.
      </>
    ),
    href: "/academy/highschool/position-sizing-and-lot-calculation",
  },
  {
    title: "Day 6: Unang small trade (optional) + journal",
    body: (
      <>
        Kung may cents account ka na at ready ka, gumawa ng 1–3 small trades gamit ang plan mo (may SL, max 1% risk, pera lang na kaya mong mawala). Kung hindi pa, i-journal muna ang 1–3 trade ideas mo. Para sa bawat trade o idea, i-journal ang:
        <ul className="my-1 list-disc pl-5">
          <li>Petsa at oras</li>
          <li>Bakit ka pumasok (1 sentence)</li>
          <li>Entry, stop loss, take profit</li>
          <li>Lot size at % risk</li>
          <li>
            Resulta, at ang <strong>natutunan mo</strong>
          </li>
        </ul>
        Hindi mahalaga kung panalo o talo. Ang mahalaga, nasunod mo ba ang plan?
      </>
    ),
  },
  {
    title: "Day 7: Review",
    body: (
      <>
        Basahin ulit ang journal mo. Sagutin: (1) Nasunod ko ba ang SL at 1% sa lahat? (2) Ano ang isang bagay na
        gagawin kong iba next week? Isulat ang <em>process</em> mo (hindi P&amp;L) sa journal mo.
      </>
    ),
  },
];

const FAQ = [
  { q: "Libre ba talaga?", a: "Oo. Libreng basahin ang lahat ng Academy lessons, walang bayad." },
  {
    q: "Kailangan ko bang mag-sign up?",
    a: "Hindi para magbasa. Optional ang sign-up kung gusto mong i-save ang progress mo.",
  },
  {
    q: "Saan ako magte-trade?",
    a: "Hindi kami nagre-recommend ng broker dito. Sa Lesson 3, malalaman mo kung paano gumagana ang cents account, at matututunan mong mag-evaluate ng broker nang sarili mo.",
  },
  {
    q: "Kikita ba ako dito?",
    a: "Walang garantiya. Ang trading ay may tunay na panganib na malugi. Ang layunin dito ay matuto ng tamang process at risk management.",
  },
  {
    q: "Magkano ang kailangan para magsimula?",
    a: "Para matuto, zero: libre ang lessons. Kung magte-trade ka, cents account na maliit na pera lang na kaya mong mawala (may minimum deposit ang bawat broker), max 1% risk per trade, laging may stop loss.",
  },
];

async function lessonMinutes(): Promise<Record<string, number>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("lessons")
      .select("slug, estimated_minutes")
      .in("slug", PATH.map((p) => p.slug))
      .eq("is_published", true);
    return Object.fromEntries((data ?? []).filter((r) => r.estimated_minutes).map((r) => [r.slug, r.estimated_minutes]));
  } catch {
    return {};
  }
}

export default async function GoldStarterPage() {
  const minutes = await lessonMinutes();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <FirstTouch />

      {/* 1. Hero */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          GFX Society Academy · Libre
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Gold Basics Starter Kit</h1>
        <p className="leading-relaxed text-muted-foreground">
          5 maikling lessons at isang 7-araw na checklist para maintindihan ang Gold (XAUUSD){" "}
          <strong>bago</strong> ka mag-trade ng totoong pera. Libre, at walang sign-up para magbasa.
        </p>
        <Link href={FIRST_LESSON_PATH} className={cn(buttonVariants({ size: "lg" }), "min-h-12 w-full text-base sm:w-auto sm:self-start")}>
          Simulan ang Lesson 1 →
        </Link>
        <p className="text-xs text-muted-foreground">~5–10 minuto bawat lesson · Basahin sa phone mo</p>
      </section>

      {/* 2. Para kanino */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Para kanino ito</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>Nagsisimula ka pa lang at nalilito sa XAUUSD, pips, at lots.</li>
          <li>Napanood mo ang Gold sa TikTok/FB at gusto mong maintindihan kung paano talaga ito gumagana.</li>
          <li>
            Gusto mong matuto ng <strong>risk management muna</strong> bago maghanap ng &quot;setup.&quot;
          </li>
        </ul>
        <p className="text-sm">
          <strong>Hindi ito para sa:</strong> naghahanap ng trade calls na &quot;sure win&quot; o mabilisang yaman. Wala
          kaming ganyan.
        </p>
      </section>

      {/* 3. 5-step path */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Ang 5-step path mo</h2>
        <ol className="flex flex-col gap-3">
          {PATH.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/academy/${p.level}/${p.slug}`}
                className="flex min-h-11 flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-muted"
              >
                <span className="font-semibold">{p.title}</span>
                <span className="text-sm text-muted-foreground">{p.desc}</span>
                {minutes[p.slug] ? (
                  <span className="text-xs text-muted-foreground">~{minutes[p.slug]} min</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ol>
        <Link href={FIRST_LESSON_PATH} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 self-start")}>
          Simulan sa Step 1 →
        </Link>
      </section>

      {/* 4. 7-day checklist */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Unang 7 Araw: Gold Starter Checklist</h2>
        <p className="text-sm italic text-muted-foreground">
          Mga 20–30 minuto lang bawat araw. Hindi kailangang perfect. Ang mahalaga, tuloy-tuloy.
        </p>
        <SevenDayChecklist days={DAYS} />
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold">🟡 Bago ang unang real-money trade mo</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
            <li>Basahin muna ang Stop Loss at Position Sizing lessons, at isulat ang plan mo.</li>
            <li>
              <strong>Start small sa cents account</strong>: real money pero maliit lang,{" "} <strong>max 1% risk per trade, laging may stop loss.</strong>
            </li>
            <li>Pera lang na kaya mong mawala. Huwag gamitin ang pambayad sa bills, utang, o emergency fund.</li>
            <li>Walang shortcut. Kung may nangangako ng &quot;sure profit,&quot; red flag iyan.</li>
          </ul>
        </div>
      </section>

      {/* 5. Risk box */}
      <section
        aria-label="Risk warning"
        className="rounded-lg border-2 border-amber-500/60 bg-amber-500/10 p-4 text-sm leading-relaxed"
      >
        <p className="font-semibold">⚠️ Ang golden rule:</p>
        <p className="mt-1">
          <strong>{RISK_LINE}</strong>
        </p>
        <p className="mt-1">Start small. Pera lang na kaya mong mawala ang gamitin.</p>
      </section>

      {/* 6. Next step (secondary) */}
      <section className="flex flex-col gap-1 text-sm">
        <p>
          <strong>Para sa later:</strong> may next step kapag ready ka na: guided training sa partner community namin. Sa
          ngayon, focus muna sa Starter Kit at Lesson 1.
        </p>
        <NextStepLink location="gold_starter" className="inline-flex min-h-11 items-center self-start font-medium underline">
          Tingnan ang steps →
        </NextStepLink>
      </section>

      {/* 7. FAQ */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">FAQ</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="rounded-lg border px-4">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">{f.q}</summary>
            <p className="pb-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </section>

      {/* 8. Footer */}
      <footer className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          <strong>Disclaimer:</strong> Trading involves real risk of loss. GFX provides education only, not financial advice. If you trade, start small (e.g., a cents account), max 1% risk per trade, always with a stop loss.
        </p>
        <p className="mt-1">
          <strong>Privacy:</strong> Wala kaming kinokolektang personal info sa page na ito. Privacy questions:{" "}
          <a href="mailto:goldfx.society@gmail.com" className="inline-flex min-h-11 items-center underline">
            goldfx.society@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
