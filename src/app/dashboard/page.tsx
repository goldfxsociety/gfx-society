import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { recommendStartingPoint } from "@/lib/diagnostic/recommendation";
import { buildLearningContext } from "@/lib/competency/build-learning-context";
import { computeCompetencyEvidence, type EvidenceLessonInput } from "@/lib/competency/evidence";
import { CompetencyCard } from "@/components/dashboard/competency-card";
import { ContinueLearningLink } from "@/components/dashboard/continue-learning-link";

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Your Progress</h1>
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

  const [context, { data: badgeData }] = await Promise.all([
    buildLearningContext(),
    supabase.from("levels").select("id, badge_name, badge_icon").eq("is_published", true),
  ]);
  const { lessons, completedLessonIds, baselineScores, attempts } = context;
  const badgesByLevelId = new Map(
    (badgeData ?? []).map((b) => [b.id as string, { badgeName: b.badge_name as string | null, badgeIcon: b.badge_icon as string | null }]),
  );

  const totalLessons = lessons.length;
  const totalCompleted = lessons.filter((l) => completedLessonIds.has(l.id)).length;
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  const recommendation = recommendStartingPoint(context);

  // The levels/badges grid still groups by level — derive that grouping
  // from the shared lesson list rather than a second query.
  const levelsMap = new Map<
    string,
    { slug: string; title: string; orderIndex: number; lessonIds: string[]; badgeName: string | null; badgeIcon: string | null }
  >();
  for (const l of lessons) {
    if (!levelsMap.has(l.levelId)) {
      const badge = badgesByLevelId.get(l.levelId);
      levelsMap.set(l.levelId, {
        slug: l.levelSlug,
        title: l.levelTitle,
        orderIndex: l.levelOrderIndex,
        lessonIds: [],
        badgeName: badge?.badgeName ?? null,
        badgeIcon: badge?.badgeIcon ?? null,
      });
    }
    levelsMap.get(l.levelId)!.lessonIds.push(l.id);
  }
  const levels = [...levelsMap.values()].sort((a, b) => a.orderIndex - b.orderIndex);

  const evidenceLessons: EvidenceLessonInput[] = lessons.map((l) => ({
    id: l.id,
    competencyKey: l.competencyKey,
    hasScoredAssessment: l.hasScoredAssessment,
  }));
  const competencyEvidence = computeCompetencyEvidence(evidenceLessons, completedLessonIds, attempts);

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
        <ContinueLearningLink
          href="/learning"
          lessonId={recommendation.lessonId}
          className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm transition-colors hover:border-primary"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            Continue Learning
          </span>
          <span className="text-xs text-muted-foreground">
            Pick up your personalized learning path.
          </span>
        </ContinueLearningLink>
      )}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Badges Earned</p>
        <div className="grid grid-cols-3 gap-3">
          {levels.map((lvl) => {
            const completedCount = lvl.lessonIds.filter((id) => completedLessonIds.has(id)).length;
            const earned = lvl.lessonIds.length > 0 && completedCount === lvl.lessonIds.length;
            return (
              <Link
                key={lvl.slug}
                href={`/academy/${lvl.slug}`}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors hover:border-primary",
                  earned ? "border-primary/30 bg-primary/10" : "border-border bg-card",
                )}
              >
                <span className={cn("text-2xl", earned ? "" : "opacity-40 grayscale")}>
                  {lvl.badgeIcon ?? "📘"}
                </span>
                <span className="text-xs font-medium">
                  {earned ? (lvl.badgeName ?? "Earned") : lvl.title}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {completedCount}/{lvl.lessonIds.length}
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
