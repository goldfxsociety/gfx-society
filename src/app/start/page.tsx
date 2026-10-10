import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { FIRST_LESSON_PATH, MESSENGER_COMMUNITY_URL } from "@/config/academy";

export const metadata: Metadata = {
  title: "Start here",
  description: "New to trading? Your first steps with the free GFX Academy — no signup needed.",
};

const STEPS = [
  {
    n: 1,
    title: "Do Lesson 1 (3 minutes)",
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
    title: "Open a free DEMO account and practise",
    body: "Demo uses virtual money on real prices. Follow the GFX rules: max 1% risk per trade, stop-loss on every trade.",
    href: "/academy/elementary/demo-account-your-practice-ground",
    cta: "Read: Demo Account lesson",
  },
  {
    n: 4,
    title: "Join the community",
    body: "Ask questions and learn with other beginners in the GFX Society Messenger community.",
    href: MESSENGER_COMMUNITY_URL,
    cta: "Join on Messenger →",
    external: true,
  },
];

export default function StartPage() {
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
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{s.body}</p>
            {s.external ? (
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "mt-3 h-11 w-full")}
              >
                {s.cta}
              </a>
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
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        Already know the basics? Log in and take the{" "}
        <Link href="/diagnostic" className="underline">
          GFX Diagnostic
        </Link>{" "}
        (free account) to find your level.
      </p>
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
        Education only, not financial advice. Trading carries a high risk of loss. Demo first.
      </p>
    </div>
  );
}
