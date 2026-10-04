import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

export default async function CompetencyLessonsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  if (!COMPETENCY_LABEL[key]) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: lessonsRaw } = await supabase
    .from("lessons")
    .select("id, slug, title, order_index, passing_score, prerequisite_lesson_id, levels(slug, title, order_index)")
    .eq("competency_key", key)
    .eq("is_published", true);

  const lessonIds = (lessonsRaw ?? []).map((l) => l.id);

  const [{ data: progress }, { data: attempts }, { data: prereqLessons }] = await Promise.all([
    lessonIds.length
      ? supabase.from("lesson_progress").select("lesson_id, completed_at").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as { lesson_id: string; completed_at: string }[] }),
    lessonIds.length
      ? supabase
          .from("assessment_attempts")
          .select("lesson_id, passed, created_at")
          .in("lesson_id", lessonIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { lesson_id: string; passed: boolean; created_at: string }[] }),
    supabase.from("lessons").select("id, title"),
  ]);

  const completedMap = new Map((progress ?? []).map((p) => [p.lesson_id, p.completed_at]));
  const latestPassedByLesson = new Map<string, boolean>();
  for (const a of attempts ?? []) {
    latestPassedByLesson.set(a.lesson_id, a.passed);
  }
  const prereqTitleById = new Map((prereqLessons ?? []).map((l) => [l.id, l.title as string]));

  const lessons = (lessonsRaw ?? [])
    .map((l) => {
      const levelInfo = Array.isArray(l.levels) ? l.levels[0] : l.levels;
      return {
        id: l.id as string,
        slug: l.slug as string,
        title: l.title as string,
        orderIndex: l.order_index as number,
        passingScore: l.passing_score as number | null,
        prerequisiteLessonId: l.prerequisite_lesson_id as string | null,
        levelSlug: (levelInfo as { slug: string } | undefined)?.slug ?? "",
        levelTitle: (levelInfo as { title: string } | undefined)?.title ?? "",
        levelOrderIndex: (levelInfo as { order_index: number } | undefined)?.order_index ?? 0,
      };
    })
    .sort((a, b) => a.levelOrderIndex - b.levelOrderIndex || a.orderIndex - b.orderIndex);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard" className="text-sm text-muted-foreground underline">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{COMPETENCY_LABEL[key]}</h1>
        <p className="text-sm text-muted-foreground">
          Lessons that build this competency, in curriculum order. Nothing here is locked — open
          any lesson anytime.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {lessons.map((lesson) => {
          const completedAt = completedMap.get(lesson.id);
          const hasAssessment = lesson.passingScore != null;
          const latestPassed = latestPassedByLesson.get(lesson.id);
          const prereqTitle = lesson.prerequisiteLessonId
            ? prereqTitleById.get(lesson.prerequisiteLessonId)
            : null;

          let statusLabel: string;
          let statusClass: string;
          if (completedAt) {
            statusLabel = "Completed";
            statusClass = "text-emerald-500";
          } else if (hasAssessment && latestPassed === false) {
            statusLabel = "Attempted — not yet passed";
            statusClass = "text-primary";
          } else {
            statusLabel = "Not started";
            statusClass = "text-muted-foreground";
          }

          return (
            <Link
              key={lesson.id}
              href={`/academy/${lesson.levelSlug}/${lesson.slug}`}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-sm transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{lesson.title}</span>
                <span className={statusClass}>{statusLabel}</span>
              </div>
              <span className="text-xs text-muted-foreground">{lesson.levelTitle}</span>
              {!hasAssessment && (
                <span className="text-xs text-muted-foreground">
                  No scored assessment exists for this lesson yet
                </span>
              )}
              {prereqTitle && !completedMap.has(lesson.prerequisiteLessonId!) && (
                <span className="text-xs text-muted-foreground">
                  💡 Builds on {prereqTitle} — consider that first if this feels unfamiliar
                </span>
              )}
            </Link>
          );
        })}
        {lessons.length === 0 && (
          <p className="text-sm text-muted-foreground">No lessons found for this competency.</p>
        )}
      </div>
    </div>
  );
}
