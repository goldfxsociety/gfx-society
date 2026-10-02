import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";

type LevelRow = {
  id: string;
  slug: string;
  title: string;
  badge_name: string | null;
  badge_icon: string | null;
  order_index: number;
  lessons: { id: string; slug: string; title: string; order_index: number }[];
};

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

  const [{ data: levelsData }, { data: progress }] = await Promise.all([
    supabase
      .from("levels")
      .select(
        "id, slug, title, badge_name, badge_icon, order_index, lessons(id, slug, title, order_index)",
      )
      .eq("is_published", true)
      .order("order_index"),
    supabase.from("lesson_progress").select("lesson_id"),
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
  const allDone = totalLessons > 0 && totalCompleted === totalLessons;

  let continueTarget: {
    levelSlug: string;
    lessonSlug: string;
    levelTitle: string;
    lessonTitle: string;
  } | null = null;
  for (const lvl of levels) {
    const next = lvl.lessons.find((les) => !completedIds.has(les.id));
    if (next) {
      continueTarget = {
        levelSlug: lvl.slug,
        lessonSlug: next.slug,
        levelTitle: lvl.title,
        lessonTitle: next.title,
      };
      break;
    }
  }

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

      {allDone ? (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
          <p className="font-semibold">🎓 Congratulations, Graduate!</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You&apos;ve completed every lesson in GFX Academy.
          </p>
        </div>
      ) : (
        continueTarget && (
          <Link
            href={`/academy/${continueTarget.levelSlug}/${continueTarget.lessonSlug}`}
            className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm transition-colors hover:border-primary"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Continue Learning
            </span>
            <span className="font-semibold">{continueTarget.lessonTitle}</span>
            <span className="text-xs text-muted-foreground">{continueTarget.levelTitle}</span>
          </Link>
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
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors hover:border-primary ${
                  earned
                    ? "border-primary/30 bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <span className={`text-2xl ${earned ? "" : "opacity-40 grayscale"}`}>
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
    </div>
  );
}
