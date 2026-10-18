import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { getLessonMinutes } from "@/lib/academy/lesson-minutes";
import { FIRST_LESSON_PATH } from "@/config/academy";
import { NEXT_STEP_HREF } from "@/config/journey";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import { NextStepLink } from "@/components/funnel/next-step-link";

export const metadata: Metadata = {
  title: "Start here",
  description: "New to trading? Your first steps with the free GFX Academy — no signup needed.",
  alternates: { canonical: "/start" },
  openGraph: {
    title: "Start here",
    description: "New to trading? Your first steps with the free GFX Academy — no signup needed.",
    url: "/start",
    images: ["/opengraph-image"],
  },
};

const STEPS = [
  {
    n: 1,
    title: "Do Lesson 1",
    body: "What is the financial market, and where does gold fit in? No account needed.",
    href: FIRST_LESSON_PATH,
    cta: "Start Lesson 1 →",
  },
  {
    n: 2,
    title: "Finish Level 1: Foundations",
    body: "5 short lessons with quick quizzes. Use the “Next lesson” button at the bottom of each lesson.",
    href: "/academy/foundations",
    cta: "See Level 1",
  },
  {
    n: 3,
    title: "Alamin ang cents account: small real money, real lessons",
    body: "Real money ito pero maliit lang, kaya ma-train mo ang emotions at money habits mo. Pera lang na kaya mong mawala, max 1% risk per trade, laging may stop loss. Optional ang MT5 demo, para lang matutunan ang buttons.",
    href: "/academy/elementary/cents-account-your-first-real-money-practice",
    cta: "Basahin: Cents Account lesson →",
  },
  {
    n: 4,
    title: "Optional: Next step: guided training sa partner community namin",
    body: "Hindi kailangan para matuto. Pero kung ready ka na, puwede kang sumali sa Discord community namin pagka-register mo sa ACCM.",
    href: NEXT_STEP_HREF,
    cta: "Tingnan ang steps →",
    note: IB_DISCLOSURE_TEXT,
  },
];

export const revalidate = 3600;

export default async function StartPage() {
  const l1Minutes = await getLessonMinutes(FIRST_LESSON_PATH.split("/").pop()!);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Start here
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Your first steps (libre)</h1>
        <p className="text-sm text-muted-foreground">
          No signup needed to learn. Create a free account later if you want to
          save your progress.
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold">
              {s.n}. {s.title}
              {s.n === 1 && l1Minutes ? ` (~${l1Minutes} min)` : ""}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{s.body}</p>
            {s.href === NEXT_STEP_HREF ? (
              <NextStepLink location="start" className={cn(buttonVariants({ variant: "outline" }), "mt-3 h-11 w-full")}>
                {s.cta}
              </NextStepLink>
            ) : (
              <Link
                href={s.href}
                className={cn(
                  buttonVariants({ variant: s.n === 1 ? "default" : "outline" }),
                  "mt-3 h-11 w-full",
                )}
              >
                {s.cta}
              </Link>
            )}
            {"note" in s && s.note ? <p className="mt-2 text-xs text-muted-foreground">{s.note}</p> : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Already know the basics? Take the GFX Diagnostic (free account) to find your level.
        </p>
        <Link href="/diagnostic" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
          GFX Diagnostic →
        </Link>
      </div>
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        Education only, not financial advice. Real risk of loss. Start small, max 1% risk, laging may stop loss.
      </p>
    </div>
  );
}
