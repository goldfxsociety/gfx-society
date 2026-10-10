import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { buildLearningContext, type LearningLesson } from "@/lib/competency/build-learning-context";
import { recommendStartingPoint, type Recommendation } from "@/lib/diagnostic/recommendation";
import { stageLabelFor } from "@/lib/competency/stage-labels";
import { ContinueLearningLink } from "@/components/dashboard/continue-learning-link";

// On a true first visit (zero completions), the "continue" reason would
// otherwise read as if the learner were resuming something — swap in a
// starting-point framing instead, without touching the other reasons, which
// already read fine on a first visit.
function reasonCopy(reason: string, isFirstVisit: boolean): string {
  if (isFirstVisit && reason === "continue") {
    return "This is your starting point — we'll guide you one step at a time from here.";
  }
  switch (reason) {
    case "meaningful_gap":
      return "We'll start by strengthening this area.";
    case "prerequisite":
      return "This lesson gives you the foundation you need for what's next.";
    case "continue":
      return "This is a great next step based on what you already know and what you've completed so far.";
    default:
      return "";
  }
}

/**
 * "Up Next" preview — calls the SAME recommendStartingPoint() repeatedly
 * against a local, throwaway copy of the completed set with each prior
 * pick hypothetically marked done. Nothing here is persisted; this is a
 * presentation convenience, not a second recommendation algorithm.
 */
function previewUpcoming(
  context: Parameters<typeof recommendStartingPoint>[0],
  firstRecommendation: Recommendation,
  count: number,
): string[] {
  const upcoming: string[] = [];
  const hypotheticalCompleted = new Set(context.completedLessonIds);
  if (firstRecommendation.kind === "lesson") {
    hypotheticalCompleted.add(firstRecommendation.lessonId);
  }

  for (let i = 0; i < count; i++) {
    const next = recommendStartingPoint({ ...context, completedLessonIds: hypotheticalCompleted });
    if (next.kind !== "lesson") break;
    upcoming.push(next.lessonId);
    hypotheticalCompleted.add(next.lessonId);
  }
  return upcoming;
}

export default async function LearningPathPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Your learning path</h1>
        <p className="text-sm text-muted-foreground">Log in to see your learning path.</p>
        <div className="flex gap-3">
          <Link href="/login" className={buttonVariants({ variant: "default" })}>
            Log in
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: "outline" })}>
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  void supabase.from("analytics_events").insert({ event_name: "learning_path_viewed" });

  const context = await buildLearningContext();
  const recommendation = recommendStartingPoint(context);
  const isFirstVisit = context.completedLessonIds.size === 0;
  const lessonById = new Map(context.lessons.map((l) => [l.id, l] as const));

  const heroLine = isFirstVisit
    ? "Here's where we recommend you start."
    : "Great job. Here's your next step.";

  let currentLesson: LearningLesson | null = null;
  let whyLine = "";
  if (recommendation.kind === "lesson") {
    currentLesson = lessonById.get(recommendation.lessonId) ?? null;
    whyLine = reasonCopy(recommendation.reason, isFirstVisit);
  }

  const upcomingIds =
    recommendation.kind === "lesson" ? previewUpcoming(context, recommendation, 2) : [];
  const upcomingLessons = upcomingIds
    .map((id) => lessonById.get(id))
    .filter((l): l is LearningLesson => !!l);

  const completedCount = context.completedLessonIds.size;
  const currentStage = currentLesson ? stageLabelFor(currentLesson.competencyKey) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Your Learning Path</h1>
          <LogoutButton />
        </div>
        <p className="text-sm text-muted-foreground">
          Your lessons are personalized based on what you already know and what you still need
          to build.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {completedCount > 0
          ? `${completedCount} lesson${completedCount === 1 ? "" : "s"} completed so far.`
          : "No lessons completed yet — let's change that."}
        {currentStage && currentStage !== "GFX Academy" && ` You're building your ${currentStage}.`}
      </p>

      {recommendation.kind === "complete" || !currentLesson ? (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/10 p-5 text-sm">
          <p className="text-lg font-semibold">🎓 You&apos;ve completed your guided path!</p>
          <p className="text-xs text-muted-foreground">
            There&apos;s more in the Academy if you&apos;d like to keep exploring.
          </p>
          <Link href="/academy" className={cn(buttonVariants({ variant: "default" }), "mt-2 self-start")}>
            Explore the Academy
          </Link>
        </div>
      ) : (
        <>
          <p className="text-base font-semibold">{heroLine}</p>

          <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/10 p-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {currentStage}
            </span>
            <p className="text-lg font-semibold">{currentLesson.title}</p>
            {currentLesson.learningObjective && (
              <p className="text-sm text-muted-foreground">{currentLesson.learningObjective}</p>
            )}
            {whyLine && <p className="text-xs text-muted-foreground">{whyLine}</p>}
            <ContinueLearningLink
              href={`/academy/${currentLesson.levelSlug}/${currentLesson.slug}`}
              lessonId={currentLesson.id}
              className={cn(buttonVariants({ variant: "default" }), "mt-1 self-start")}
            >
              {isFirstVisit ? "Start This Lesson" : "Continue Learning"}
            </ContinueLearningLink>
          </div>

          {upcomingLessons.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Up Next
              </p>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {upcomingLessons.map((l) => (
                  <li key={l.id}>• {l.title}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-semibold">Your path is personalized</p>
        <p className="text-xs text-muted-foreground">
          Based on your starting assessment and your progress, GFX Academy adjusts what you
          should focus on next.
        </p>
      </div>

      <Link href="/academy" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
        Explore the Academy
      </Link>
    </div>
  );
}
