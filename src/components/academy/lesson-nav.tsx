import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import type { NavLesson } from "@/lib/academy/lesson-sequence";

export function LessonNav({
  prev,
  next,
  currentLevelTitle,
  nextLevelTitle,
  isLastInLevel,
  nextIsPrimary = true,
}: {
  prev: NavLesson | null;
  next: NavLesson | null;
  currentLevelTitle: string;
  nextLevelTitle: string | null;
  isLastInLevel: boolean;
  /** false on Lesson 1, where the Messenger CTA is the single primary (UX audit #6). */
  nextIsPrimary?: boolean;
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
                Up next: {nextLevelTitle}. Keep practising on demo as you go.
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
                You&apos;ve finished the GFX Academy. Keep journaling your demo
                trades and join the community to keep learning.
              </p>
              <Link
                href="/community"
                className={cn(buttonVariants({ variant: "default" }), "mt-3 h-11 w-full")}
              >
                Join the GFX community →
              </Link>
            </>
          )}
        </div>
      )}
      {next && !levelComplete && (
        <Link
          href={`/academy/${next.levelSlug}/${next.slug}`}
          className={cn(
            buttonVariants({ variant: nextIsPrimary ? "default" : "outline" }),
            "h-auto min-h-12 w-full flex-col whitespace-normal py-2 text-center",
          )}
        >
          <span className="text-base font-semibold">Next lesson →</span>
          <span className="text-sm opacity-80">{next.title}</span>
        </Link>
      )}
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
