import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { recommendStartingPoint } from "@/lib/diagnostic/recommendation";
import { buildLearningContext } from "@/lib/competency/build-learning-context";
import { computeCompetencyEvidence, type EvidenceLessonInput } from "@/lib/competency/evidence";
import { CompetencyCard } from "@/components/dashboard/competency-card";
import { ContinueLearningLink } from "@/components/dashboard/continue-learning-link";
import { getLessonMinutes } from "@/lib/academy/lesson-minutes";

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
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Your Progress</h1>
        <p className="text-base">
          I-save ang Academy progress mo gamit ang free account.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Makita kung aling lessons at quizzes ang natapos mo na</li>
          <li>Continue kung saan ka tumigil, sa kahit anong device</li>
          <li>Take the GFX Diagnostic para malaman ang level mo</li>
        </ul>
        <Link href="/signup" className={cn(buttonVariants({ variant: "default" }), "h-12 w-full text-base")}>
          Create free account →
        </Link>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
          May account ka na? Log in
        </Link>
        <Link href="/start" className="inline-flex min-h-11 items-center justify-center text-sm underline">
          O start muna sa Lesson 1, no sign-up needed
        </Link>
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
  const nextLesson =
    recommendation.kind === "lesson" ? lessons.find((l) => l.id === recommendation.lessonId) ?? null : null;
  const nextMinutes = nextLesson ? await getLessonMinutes(nextLesson.slug) : null;

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
  const assessedCount = COMPETENCY_ORDER.filter(
    (k) => (competencyEvidence[k]?.status ?? "No Evidence") !== "No Evidence" || baselineScores?.[k] != null,
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Progress</span>
        <h1 className="text-2xl font-bold tracking-tight">Your Progress</h1>
      </div>

      {/* "Next" first (logged-in audit #2). */}
      {recommendation.kind === "complete" ? (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          <p className="font-semibold">🎓 Congrats, Graduate! Natapos mo na ang lahat ng lessons sa GFX Academy.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Demo muna bago live. Kung mag-live ka, optional ang cents account na maliit na pera lang na kaya mong
            mawala. Max 1% risk bawat trade, laging may stop loss.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">Next</span>
          <p className="text-base font-semibold">
            {nextLesson ? nextLesson.title : "Your next lesson"}
            {nextMinutes ? <span className="font-normal text-muted-foreground"> · ~{nextMinutes} min</span> : null}
          </p>
          <ContinueLearningLink
            href={nextLesson ? `/academy/${nextLesson.levelSlug}/${nextLesson.slug}` : "/learning"}
            lessonId={recommendation.lessonId}
            className={cn(buttonVariants({ variant: "default" }), "h-12 w-full text-base")}
          >
            Continue →
          </ContinueLearningLink>
          <Link href="/learning" className="inline-flex min-h-11 items-center text-sm underline">
            See my learning path
          </Link>
        </div>
      )}

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
        <p className="text-sm text-muted-foreground">
          {totalCompleted} of {totalLessons} lessons completed
        </p>
      </div>


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

      {/* Collapsed by default; friendlier empty state (logged-in audit #2). */}
      <details className="rounded-lg border border-border bg-card px-4">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 text-sm font-semibold">
          <span>See skills ({COMPETENCY_ORDER.length})</span>
          <span className="font-normal text-muted-foreground">
            {assessedCount > 0 ? `${assessedCount} ${assessedCount === 1 ? "skill" : "skills"} may data na` : "Wala pang data"}
          </span>
        </summary>
        {assessedCount === 0 && (
          <p className="pb-2 text-sm text-muted-foreground">
            Wala pang data dito. Mag-take ng lesson o ng GFX Diagnostic para makita ang skills mo.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2">
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
      </details>

      <div className="flex flex-col gap-2">
        <Link href="/account" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
          Account settings
        </Link>
        <LogoutButton className="h-11 w-full" />
      </div>
    </div>
  );
}
