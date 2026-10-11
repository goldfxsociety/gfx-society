import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RiskFooter } from "@/components/academy/risk-footer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { getLessonSequence } from "@/lib/academy/lesson-sequence";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LevelPage({
  params,
}: {
  params: Promise<{ levelSlug: string }>;
}) {
  const { levelSlug } = await params;
  const supabase = await createClient();

  const { data: level } = await supabase
    .from("levels")
    .select("id, slug, title, description")
    .eq("slug", levelSlug)
    .eq("is_published", true)
    .single();

  if (!level) notFound();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, slug, title, estimated_minutes, order_index")
    .eq("level_id", level.id)
    .eq("is_published", true)
    .order("order_index");

  // Completed state for logged-in learners (logged-in audit #1). RLS limits
  // lesson_progress to the user's own rows.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const done = new Set<string>();
  if (user && lessons?.length) {
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed_at")
      .in("lesson_id", lessons.map((l) => l.id));
    for (const p of progress ?? []) if (p.completed_at) done.add(p.lesson_id);
  }
  const list = lessons ?? [];
  const nextIdx = list.findIndex((l) => !done.has(l.id));
  const allDone = list.length > 0 && nextIdx === -1;
  let nextLevelHref: string | null = null;
  if (allDone) {
    const seq = await getLessonSequence(supabase);
    const after = seq.findIndex((l) => l.levelSlug === level.slug && l.slug === list[list.length - 1].slug);
    const n = after >= 0 ? seq[after + 1] : undefined;
    if (n) nextLevelHref = `/academy/${n.levelSlug}/${n.slug}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/academy" className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
          ← Back to Academy
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{level.title}</h1>
        <p className="text-sm text-muted-foreground">{level.description}</p>
      </div>

      <div className="flex flex-col gap-3">
        {(lessons ?? []).map((lesson, i) => (
          <Link key={lesson.id} href={`/academy/${level.slug}/${lesson.slug}`} className="block min-h-11">
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span>
                    {i + 1}. {lesson.title}
                  </span>
                  {done.has(lesson.id) && (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      ✓ Tapos na<span className="sr-only"> (completed)</span>
                    </span>
                  )}
                </CardTitle>
                {lesson.estimated_minutes && (
                  <CardDescription>
                    {lesson.estimated_minutes} min
                  </CardDescription>
                )}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {list.length > 0 && !allDone && (
        <Link
          href={`/academy/${level.slug}/${list[nextIdx].slug}`}
          className={cn(buttonVariants({ variant: "default" }), "h-12 w-full text-base")}
        >
          {nextIdx === 0 ? "Start lesson 1 →" : `Continue: Lesson ${nextIdx + 1} →`}
        </Link>
      )}
      {allDone && (
        <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold">✓ Tapos mo na ang {level.title.replace(/^(Level \d+):\s*/, "$1 — ")}!</p>
          <Link
            href={nextLevelHref ?? "/academy"}
            className={cn(buttonVariants({ variant: "default" }), "h-12 w-full text-base")}
          >
            {nextLevelHref ? "Continue to the next level →" : "Back to the Academy →"}
          </Link>
        </div>
      )}

      <RiskFooter />
    </div>
  );
}
