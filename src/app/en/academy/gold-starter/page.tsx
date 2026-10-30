import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/server";
import { FirstTouch } from "@/components/funnel/first-touch";
import { SevenDayChecklist } from "@/components/funnel/seven-day-checklist";
import { LanguageSwitch } from "@/components/academy/language-switch";
import { StarterCta } from "@/components/academy/starter-cta";
import { TITLE, DESCRIPTION, HERO, PATH, LESSON_NOTE, OPEN_LESSON, DAYS, BOX, RISK_LINE_EN, FAQ, DISCLAIMER, PRIVACY } from "@/content/en-gold-starter";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: "/en/academy/gold-starter",
    languages: { en: "/en/academy/gold-starter", "fil-PH": "/academy/gold-starter", "x-default": "/academy/gold-starter" },
  },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/en/academy/gold-starter", locale: "en", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const revalidate = 3600;

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

export default async function EnGoldStarterPage() {
  const minutes = await lessonMinutes();
  return (
    <div lang="en" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <FirstTouch />

      <section className="flex flex-col gap-3">
        <LanguageSwitch current="en" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{HERO.eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight">{HERO.h1}</h1>
        <p className="leading-relaxed text-muted-foreground">
          A 5-step path and a 7-day checklist to help you understand gold (XAUUSD) <strong>before</strong> you trade real
          money. Free, and no sign-up needed.
        </p>
        <StarterCta className={cn(buttonVariants({ size: "lg" }), "min-h-12 w-full text-base sm:w-auto sm:self-start")}>
          {HERO.cta}
        </StarterCta>
        <p className="text-xs text-muted-foreground">{HERO.micro}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Who this is for</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>You&apos;re new and XAUUSD, pips and lots still confuse you.</li>
          <li>You&apos;ve seen gold trading on TikTok and want to know how it really works.</li>
          <li>
            You want to learn <strong>risk management first</strong>, before looking for a &quot;setup.&quot;
          </li>
        </ul>
        <p className="text-sm">
          <strong>This is not for you if</strong> you want &quot;sure win&quot; trade calls or fast money. We don&apos;t
          offer that.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Your 5-step path</h2>
        <ol className="flex flex-col gap-3">
          {PATH.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/academy/${p.level}/${p.slug}`}
                className="flex min-h-11 flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-muted"
              >
                <span className="font-semibold">{p.title}</span>
                <span className="text-sm text-muted-foreground">{p.desc}</span>
                <span className="text-xs text-[#c4b5d4]">{LESSON_NOTE}</span>
                {minutes[p.slug] ? <span className="text-xs text-muted-foreground">~{minutes[p.slug]} min</span> : null}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section id="checklist" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="text-xl font-semibold">Your First 7 Days: Gold Starter Checklist</h2>
        <p className="text-sm italic text-muted-foreground">
          About 20–30 minutes a day. It doesn&apos;t have to be perfect. Just keep going.
        </p>
        <SevenDayChecklist days={DAYS} storageKey="gfx_gold_starter_7day_en" lessonLinkLabel={OPEN_LESSON} />
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold">{BOX.title}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
            {BOX.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Risk warning" className="rounded-lg border-2 border-amber-500/60 bg-amber-500/10 p-4 text-sm leading-relaxed">
        <p className="font-semibold">⚠️ The golden rule:</p>
        <p className="mt-1">
          <strong>{RISK_LINE_EN}</strong>
        </p>
        <p className="mt-1">Education only, not financial advice.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">FAQ</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="rounded-lg border px-4">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">{f.q}</summary>
            <p className="pb-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </section>

      <footer className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          <strong>Disclaimer:</strong> {DISCLAIMER}
        </p>
        <p className="mt-1">
          <strong>Privacy:</strong> {PRIVACY}{" "}
          <a href="mailto:goldfx.society@gmail.com" className="inline-flex min-h-11 items-center underline">
            goldfx.society@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
