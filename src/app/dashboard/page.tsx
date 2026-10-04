import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { recommendStartingPoint, type LessonRow } from "@/lib/diagnostic/recommendation";
import type { CompetencyTier, CompetencyScore } from "@/lib/diagnostic/scoring";
import {
  computeCompetencyEvidence,
  type EvidenceLessonInput,
  type AssessmentAttemptInput,
} from "@/lib/competency/evidence";
import { CompetencyCard } from "@/components/dashboard/competency-card";
import { ContinueLearningLink } from "@/components/dashboard/continue-learning-link";

type LevelRow = {
  id: string;
  slug: string;
  title: string;
  badge_name: string | null;
  badge_icon: string | null;
  order_index: number;
  lessons: {
    id: string;
    slug: string;
    title: string;
    order_index: number;
    competency_key: string | null;
    prerequisite_lesson_id: string | null;
    passing_score: number | null;
  }[];
};

const COMPETENCY_ORDER = [
  "foundations",
  "platform",
  "price_action",
  "market_structure",
  "technical_tools",
  "gold",
  "setups",
  "risk_management",
  "psychology",
  "journaling",
] as const;

const COMPETENCY_LABEL: Record<string, string> = {
  foundations: "Foundations",
  platform: "Platform & MT5",
  price_action: "Candlesticks & Price Action",
  market_structure: "Market Structure",
  technical_tools: "Technical Tools",
  gold: "Gold / XAUUSD",
  setups: "Trading Setups",
  risk_management: "Risk Management",
  psychology: "Trading Psychology",
  journaling: "Journaling",
};

function recommendationReasonCopy(reason: string): string {
  switch (reason) {
    case "meaningful_gap":
      return "Recommended because this is an area you're still building.";
    case "prerequisite":
      return "This lesson is a prerequisite for a later lesson in your path.";
    case "continue":
      return "Continuing where you left off.";
    default:
      return "";
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">Log in to see your dashboard.</p>
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

  void supabase.from("analytics_events").insert({ event_name: "competency_dashboard_viewed" });

  const [{ data: levelsData }, { data: progress }, { data: attemptsRaw }, { data: latestDiagnostic }] =
    await Promise.all([
      supabase
        .from("levels")
        .select(
          "id, slug, title, badge_name, badge_icon, order_index, lessons(id, slug, title, order_index, competency_key, prerequisite_lesson_id, passing_score)",
        )
        .eq("is_published", true)
        .order("order_index"),
      supabase.from("lesson_progress").select("lesson_id"),
      supabase.from("assessment_attempts").select("lesson_id, passed, created_at"),
      supabase
        .from("diagnostic_sessions")
        .select("competency_scores")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));

  const levels = ((levelsData as LevelRow[] | null) ?? []).map((lvl) => ({
    ...lvl,
    lessons: [...lvl.lessons].sort((a, b) => a.order_index - b.order_index),
  }));

  const totalLessons = levels.reduce((sum, l) => sum + l.lessons.length, 0);
  const totalCompleted = levels.reduce(
    (sum, l) => sum + l.lessons.filter((les) => completedIds.has(les.id)).length,
    0,
  );
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  // Flatten for the recommendation engine and the evidence calculator — both
  // read from the exact same lesson list, built once here.
  const allLessons: LessonRow[] = levels.flatMap((lvl) =>
    lvl.lessons.map((les) => ({
      id: les.id,
      levelId: lvl.id,
      levelOrderIndex: lvl.order_index,
      orderIndex: les.order_index,
      competencyKey: les.competency_key,
      prerequisiteLessonId: les.prerequisite_lesson_id,
    })),
  );

  const attempts: AssessmentAttemptInput[] = (attemptsRaw ?? []).map((a) => ({
    lessonId: a.lesson_id as string,
    passed: a.passed as boolean,
    createdAt: a.created_at as string,
  }));

  // Same "struggling" definition used by the recommendation engine's own
  // input prep in complete-session.ts (latest attempt failed, no later pass).
  const sortedAttempts = [...attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latestPassedByLesson = new Map<string, boolean>();
  for (const a of sortedAttempts) {
    latestPassedByLesson.set(a.lessonId, a.passed);
  }
  const strugglingLessonIds = new Set(
    [...latestPassedByLesson.entries()].filter(([, passed]) => !passed).map(([id]) => id),
  );

  const baselineScores = (latestDiagnostic?.competency_scores ?? null) as Record<
    string,
    CompetencyScore
  > | null;
  const competencyTiers: Record<string, CompetencyTier> = {};
  if (baselineScores) {
    for (const [key, score] of Object.entries(baselineScores)) {
      competencyTiers[key] = score.tier;
    }
  }

  const recommendation = recommendStartingPoint({
    lessons: allLessons,
    completedLessonIds: completedIds,
    strugglingLessonIds,
    competencyTiers,
  });

  let continueTarget:
    | { levelSlug: string; lessonSlug: string; levelTitle: string; lessonTitle: string; reason: string }
    | null = null;
  if (recommendation.kind === "lesson") {
    for (const lvl of levels) {
      const lesson = lvl.lessons.find((l) => l.id === recommendation.lessonId);
      if (lesson) {
        continueTarget = {
          levelSlug: lvl.slug,
          lessonSlug: lesson.slug,
          levelTitle: lvl.title,
          lessonTitle: lesson.title,
          reason: recommendationReasonCopy(recommendation.reason),
        };
        break;
      }
    }
  }

  const evidenceLessons: EvidenceLessonInput[] = allLessons.map((l) => ({
    id: l.id,
    competencyKey: l.competencyKey,
    hasScoredAssessment:
      levels
        .flatMap((lvl) => lvl.lessons)
        .find((les) => les.id === l.id)?.passing_score != null,
  }));
  const competencyEvidence = computeCompetencyEvidence(evidenceLessons, completedIds, attempts);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Dashboard
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Your Progress</h1>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall completion</span>
          <span className="font-semibold text-primary">{overallPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {totalCompleted} of {totalLessons} lessons completed
        </p>
      </div>

      {recommendation.kind === "complete" ? (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          <p className="font-semibold">🎓 Congratulations, Graduate!</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You&apos;ve completed every lesson in GFX Academy.
          </p>
        </div>
      ) : (
        continueTarget && (
          <ContinueLearningLink
            href={`/academy/${continueTarget.levelSlug}/${continueTarget.lessonSlug}`}
            lessonId={recommendation.kind === "lesson" ? recommendation.lessonId : ""}
            className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm transition-colors hover:border-primary"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Continue Learning
            </span>
            <span className="font-semibold">{continueTarget.lessonTitle}</span>
            <span className="text-xs text-muted-foreground">{continueTarget.levelTitle}</span>
            {continueTarget.reason && (
              <span className="text-xs text-muted-foreground">{continueTarget.reason}</span>
            )}
          </ContinueLearningLink>
        )
      )}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Badges Earned</p>
        <div className="grid grid-cols-3 gap-3">
          {levels.map((lvl) => {
            const completedCount = lvl.lessons.filter((les) => completedIds.has(les.id)).length;
            const earned = lvl.lessons.length > 0 && completedCount === lvl.lessons.length;
            return (
              <Link
                key={lvl.id}
                href={`/academy/${lvl.slug}`}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors hover:border-primary",
                  earned ? "border-primary/30 bg-primary/10" : "border-border bg-card",
                )}
              >
                <span className={cn("text-2xl", earned ? "" : "opacity-40 grayscale")}>
                  {lvl.badge_icon ?? "📘"}
                </span>
                <span className="text-xs font-medium">
                  {earned ? (lvl.badge_name ?? "Earned") : lvl.title}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {completedCount}/{lvl.lessons.length}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Your Competencies</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COMPETENCY_ORDER.map((key) => {
            const evidence = competencyEvidence[key] ?? {
              competencyKey: key,
              total: 0,
              completed: 0,
              scoredTotal: 0,
              struggling: false,
              status: "No Evidence" as const,
              coverage: "none" as const,
            };
            return (
              <CompetencyCard
                key={key}
                label={COMPETENCY_LABEL[key]}
                competencyKey={key}
                evidence={evidence}
                baseline={baselineScores?.[key] ?? null}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
