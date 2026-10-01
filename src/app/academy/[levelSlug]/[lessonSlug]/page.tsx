import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarkCompleteButton } from "@/components/academy/mark-complete-button";
import {
  ScenarioQuizBlock,
  type ScenarioQuizScenario,
} from "@/components/lesson-engine/blocks/scenario-quiz-block";
import { CandlestickAnatomyDiagram } from "@/components/lesson-engine/blocks/candlestick-anatomy-diagram";
import {
  CandlestickPlotBlock,
  type CandlestickPreset,
} from "@/components/lesson-engine/blocks/candlestick-plot-block";
import { CandlestickFreehandPractice } from "@/components/lesson-engine/blocks/candlestick-freehand-practice";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ levelSlug: string; lessonSlug: string }>;
}) {
  const { levelSlug, lessonSlug } = await params;
  const supabase = await createClient();

  const { data: level } = await supabase
    .from("levels")
    .select("id, slug, title")
    .eq("slug", levelSlug)
    .eq("is_published", true)
    .single();

  if (!level) notFound();

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, title, learning_objective, content, key_takeaways, lesson_type, interactive_config",
    )
    .eq("level_id", level.id)
    .eq("slug", lessonSlug)
    .eq("is_published", true)
    .single();

  if (!lesson) notFound();

  const keyTakeaways = Array.isArray(lesson.key_takeaways)
    ? (lesson.key_takeaways as string[])
    : [];

  const isScenarioQuiz = lesson.lesson_type === "scenario_quiz";
  const scenarios = isScenarioQuiz
    ? ((lesson.interactive_config as { scenarios: ScenarioQuizScenario[] } | null)
        ?.scenarios ?? [])
    : [];

  const isCandlestickPlot = lesson.lesson_type === "candlestick_plot";
  const candlestickConfig = isCandlestickPlot
    ? (lesson.interactive_config as {
        showAnatomyDiagram?: boolean;
        includeFreehandPractice?: boolean;
        presets: CandlestickPreset[];
      } | null)
    : null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let completedAt: string | null = null;
  if (user) {
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("completed_at")
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    completedAt = progress?.completed_at ?? null;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <Link
        href={`/academy/${level.slug}`}
        className="text-sm text-zinc-500 underline"
      >
        ← Back to {level.title}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>

      {lesson.learning_objective && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
          <span className="font-semibold">Learning objective: </span>
          {lesson.learning_objective}
        </div>
      )}

      <div className="whitespace-pre-line text-sm leading-7 text-zinc-700 dark:text-zinc-300">
        {lesson.content}
      </div>

      {isCandlestickPlot && candlestickConfig?.showAnatomyDiagram && (
        <CandlestickAnatomyDiagram />
      )}

      {isCandlestickPlot && candlestickConfig && (
        <CandlestickPlotBlock presets={candlestickConfig.presets} />
      )}

      {isCandlestickPlot && candlestickConfig?.includeFreehandPractice && (
        <CandlestickFreehandPractice />
      )}

      {keyTakeaways.length > 0 && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-2 text-sm font-semibold">Key takeaways</p>
          <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
            {keyTakeaways.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {user && completedAt && (
        <p className="text-sm font-medium text-emerald-600">
          ✓ Completed on {new Date(completedAt).toLocaleDateString()}
        </p>
      )}

      {isScenarioQuiz ? (
        <>
          <ScenarioQuizBlock
            lessonId={lesson.id}
            scenarios={scenarios}
            canSave={!!user}
          />
          {!user && (
            <p className="text-sm text-zinc-500">
              <Link href="/login" className="underline">
                Log in
              </Link>{" "}
              to save your quiz result.
            </p>
          )}
        </>
      ) : (
        <>
          {!user && (
            <p className="text-sm text-zinc-500">
              <Link href="/login" className="underline">
                Log in
              </Link>{" "}
              to save your progress on this lesson.
            </p>
          )}
          {user && !completedAt && <MarkCompleteButton lessonId={lesson.id} />}
        </>
      )}
    </div>
  );
}
