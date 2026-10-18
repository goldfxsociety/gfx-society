import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import type { NavLesson } from "@/lib/academy/lesson-sequence";
import { NextStepLink } from "@/components/funnel/next-step-link";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";

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
  /** Rendered right below the primary CTA (Next lesson / Start next level), above the Previous link. */
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
              <Link
                href={`/academy/${next.levelSlug}/${next.slug}`}
                className={cn(buttonVariants({ variant: "default" }), "mt-3 h-11 w-full")}
              >
                Start {nextLevelTitle} →
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Natapos mo na ang GFX Academy! 🎉 Keep journaling every trade. Kapag ready ka na, puwede kang sumali sa
                Discord community namin pagka-register mo sa ACCM.
              </p>
              <NextStepLink
                location="academy_complete"
                className={cn(buttonVariants({ variant: "default" }), "mt-3 h-auto min-h-11 w-full whitespace-normal py-2 text-center")}
              >
                Next step: guided training sa partner community namin →
              </NextStepLink>
              <p className="mt-2 text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
            </>
          )}
        </div>
      )}
      {next && !levelComplete && (
        <Link
          href={`/academy/${next.levelSlug}/${next.slug}`}
          className={cn(
            buttonVariants({ variant: "default" }),
            "h-auto min-h-12 w-full flex-col whitespace-normal py-2 text-center",
          )}
        >
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
