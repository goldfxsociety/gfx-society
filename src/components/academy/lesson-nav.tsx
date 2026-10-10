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
}: {
  prev: NavLesson | null;
  next: NavLesson | null;
  currentLevelTitle: string;
  nextLevelTitle: string | null;
  isLastInLevel: boolean;
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
      <div className="grid grid-cols-2 gap-3">
        {prev ? (
          <Link
            href={`/academy/${prev.levelSlug}/${prev.slug}`}
            className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 flex-col items-start whitespace-normal py-2 text-left")}
          >
            <span className="text-xs text-muted-foreground">← Previous</span>
            <span className="text-sm">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && !levelComplete && (
          <Link
            href={`/academy/${next.levelSlug}/${next.slug}`}
            className={cn(buttonVariants({ variant: "default" }), "h-auto min-h-11 flex-col items-end whitespace-normal py-2 text-right")}
          >
            <span className="text-xs opacity-80">Next lesson →</span>
            <span className="text-sm">{next.title}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
