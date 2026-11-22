import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import type { NavLesson } from "@/lib/academy/lesson-sequence";
import { NextStepLink } from "@/components/funnel/next-step-link";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import { JOIN_SYSTEM_CTA } from "@/content/access-request";
import { LESSON_DISCORD_HREF, LESSON_DISCORD_LINK } from "@/content/accm-guide";
import { Expander } from "@/components/layout/expander";
import { JOIN_COPY, MEMBERS_ONLY_HINT } from "@/content/members-gate";

/** Gold "Next lesson →" with the next lesson's title as a muted subtitle (lesson-end-buttons spec: one label mid-course). */
const NEXT_GOLD = cn(buttonVariants({ variant: "default" }), "h-auto min-h-12 w-full flex-col whitespace-normal py-2 text-center");

/**
 * Lesson-end help (lesson-end-buttons spec + P3-13): Discord is never gold and never a card; it is a muted text link
 * ("Paano sumali sa Universe Unlimited Discord →") under a closed "May problema?" expander. It deep-links to the Discord
 * step on /accm (ACCM first, then the invite; never straight to discord.gg), so the IB line sits in the same expander.
 */
export function LessonHelp() {
  return (
    <Expander summary={JOIN_COPY.helpSummary} testId="lesson-help">
      <NextStepLink location="lesson_help" href={LESSON_DISCORD_HREF} className="inline-flex min-h-11 items-center self-start underline">
        {LESSON_DISCORD_LINK}
      </NextStepLink>
      <p className="text-xs">{IB_DISCLOSURE_TEXT}</p>
    </Expander>
  );
}

export function LessonNav({
  prev,
  next,
  currentLevelTitle,
  nextLevelTitle,
  isLastInLevel,
  afterPrimary,
}: {
  prev: NavLesson | null;
  next: NavLesson | null;
  currentLevelTitle: string;
  nextLevelTitle: string | null;
  isLastInLevel: boolean;
  /** Rendered right below the primary CTA (Next lesson / Join the Trading System), above the Previous link. */
  afterPrimary?: ReactNode;
}) {
  const levelComplete = isLastInLevel;
  return (
    <nav aria-label="Lesson navigation" className="flex flex-col gap-3">
      {levelComplete && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
          <p className="text-sm font-semibold">
            🎉 That&apos;s the last lesson of {currentLevelTitle}.
          </p>
          {next && nextLevelTitle ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Up next: {nextLevelTitle}. Tuloy lang sa plan mo: max 1% risk, laging may stop loss.
              </p>
              <Link href={`/academy/${next.levelSlug}/${next.slug}`} className={cn(NEXT_GOLD, "mt-3")} data-testid="lesson-next">
                <span className="text-base font-semibold">Next lesson →</span>
                <span className="text-sm opacity-80">{next.title}</span>
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Natapos mo na ang GFX Academy! 🎉 Keep journaling every trade.
              </p>
              <p className="mt-1 text-xs text-muted-foreground" data-testid="members-only-hint">{MEMBERS_ONLY_HINT}</p>
              {/* Last Academy lesson: gold Join the Trading System (lesson-end-buttons spec); Discord is in LessonHelp. */}
              <NextStepLink
                location="academy_complete"
                href="/system/join"
                className={cn(buttonVariants({ variant: "default" }), "mt-3 h-11 w-full")}
              >
                {JOIN_SYSTEM_CTA}
              </NextStepLink>
              <p className="mt-2 text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
            </>
          )}
        </div>
      )}
      {next && !levelComplete && (
        <Link href={`/academy/${next.levelSlug}/${next.slug}`} className={NEXT_GOLD} data-testid="lesson-next">
          <span className="text-base font-semibold">Next lesson →</span>
          <span className="text-sm opacity-80">{next.title}</span>
        </Link>
      )}
      {afterPrimary}
      <div>
        {prev ? (
          <Link
            href={`/academy/${prev.levelSlug}/${prev.slug}`}
            className={cn(buttonVariants({ variant: "ghost" }), "h-auto min-h-11 w-full flex-col items-start whitespace-normal py-2 text-left")}
          >
            <span className="text-xs text-muted-foreground">← Previous</span>
            <span className="text-sm">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  );
}
