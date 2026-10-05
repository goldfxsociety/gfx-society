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
import {
  PatternIntroGrid,
  type PatternDef,
} from "@/components/lesson-engine/blocks/pattern-intro-grid";
import { PatternRecognitionBlock } from "@/components/lesson-engine/blocks/pattern-recognition-block";
import { RsiMaTool } from "@/components/lesson-engine/blocks/rsi-ma-tool";
import { FibonacciCalculator } from "@/components/lesson-engine/blocks/fibonacci-calculator";
import { LotSizeCalculator } from "@/components/lesson-engine/blocks/lot-size-calculator";
import { RiskRewardCalculator } from "@/components/lesson-engine/blocks/risk-reward-calculator";
import { JournalToolBlock } from "@/components/lesson-engine/blocks/journal-tool-block";
import { SessionCheckerBlock } from "@/components/lesson-engine/blocks/session-checker-block";
import {
  ConceptIntroGrid,
  type ConceptDef,
} from "@/components/lesson-engine/blocks/concept-intro-grid";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ levelSlug: string; lessonSlug: string }>;
}) {
  const { levelSlug, lessonSlug } = await params;
  const supabase = await createClient();

  const [{ data: level }, userResult] = await Promise.all([
    supabase
      .from("levels")
      .select("id, slug, title")
      .eq("slug", levelSlug)
      .eq("is_published", true)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!level) notFound();

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, title, learning_objective, content, key_takeaways, lesson_type, interactive_config, passing_score, prerequisite_lesson_id",
    )
    .eq("level_id", level.id)
    .eq("slug", lessonSlug)
    .eq("is_published", true)
    .single();

  if (!lesson) notFound();

  const keyTakeaways = Array.isArray(lesson.key_takeaways)
    ? (lesson.key_takeaways as string[])
    : [];

  // Read unconditionally (not gated to lesson_type === "scenario_quiz") so a
  // tool-type lesson (e.g. candlestick_plot, rsi_ma_tool) can carry its own
  // scenarios array and render a scored quiz alongside its interactive tool,
  // rather than only as a standalone lesson type.
  const scenarioConfig = lesson.interactive_config as {
    scenarios?: ScenarioQuizScenario[];
    introConcepts?: ConceptDef[];
  } | null;
  const scenarios = scenarioConfig?.scenarios ?? [];
  const introConcepts = scenarioConfig?.introConcepts;
  const hasScoredQuiz = scenarios.length > 0;

  const isCandlestickPlot = lesson.lesson_type === "candlestick_plot";
  const candlestickConfig = isCandlestickPlot
    ? (lesson.interactive_config as {
        showAnatomyDiagram?: boolean;
        includeFreehandPractice?: boolean;
        presets: CandlestickPreset[];
      } | null)
    : null;

  const isPatternRecognition = lesson.lesson_type === "pattern_recognition";
  const patternConfig = isPatternRecognition
    ? (lesson.interactive_config as {
        patterns: PatternDef[];
        lookalikes?: Record<string, string[]>;
        rounds?: number;
      } | null)
    : null;

  const isRsiMaTool = lesson.lesson_type === "rsi_ma_tool";
  const isFibCalc = lesson.lesson_type === "fibonacci_calculator";
  const isLotSizeCalc = lesson.lesson_type === "lot_size_calculator";
  const isRrCalc = lesson.lesson_type === "risk_reward_calculator";
  const isJournalTool = lesson.lesson_type === "journal_tool";
  const isSessionChecker = lesson.lesson_type === "session_checker";

  const {
    data: { user },
  } = userResult;

  let completedAt: string | null = null;
  let prerequisite: { title: string; slug: string; levelSlug: string; completed: boolean } | null =
    null;

  if (user) {
    void supabase.from("analytics_events").insert({
      event_name: "lesson_started",
      entity_id: lesson.id,
    });

    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("completed_at")
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    completedAt = progress?.completed_at ?? null;

    if (lesson.prerequisite_lesson_id) {
      const [{ data: prereqLesson }, { data: prereqProgress }] = await Promise.all([
        supabase
          .from("lessons")
          .select("slug, title, levels(slug)")
          .eq("id", lesson.prerequisite_lesson_id)
          .single(),
        supabase
          .from("lesson_progress")
          .select("completed_at")
          .eq("lesson_id", lesson.prerequisite_lesson_id)
          .maybeSingle(),
      ]);

      const prereqLevel = Array.isArray(prereqLesson?.levels)
        ? prereqLesson.levels[0]
        : prereqLesson?.levels;

      if (prereqLesson && prereqLevel) {
        prerequisite = {
          title: prereqLesson.title,
          slug: prereqLesson.slug,
          levelSlug: (prereqLevel as { slug: string }).slug,
          completed: !!prereqProgress?.completed_at,
        };
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <Link
        href={`/academy/${level.slug}`}
        className="text-sm text-muted-foreground underline"
      >
        ← Back to {level.title}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>

      {prerequisite && !prerequisite.completed && (
        <p className="text-xs text-muted-foreground">
          💡 This lesson builds on{" "}
          <Link
            href={`/academy/${prerequisite.levelSlug}/${prerequisite.slug}`}
            className="underline"
          >
            {prerequisite.title}
          </Link>{" "}
          — consider completing that first if this feels unfamiliar.
        </p>
      )}

      {lesson.learning_objective && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
          <span className="font-semibold">Learning objective: </span>
          {lesson.learning_objective}
        </div>
      )}

      <div className="whitespace-pre-line text-sm leading-7 text-foreground/90">
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

      {isPatternRecognition && patternConfig && (
        <PatternIntroGrid patterns={patternConfig.patterns} />
      )}

      {hasScoredQuiz && introConcepts && (
        <ConceptIntroGrid concepts={introConcepts} />
      )}

      {isRsiMaTool && <RsiMaTool />}

      {isFibCalc && <FibonacciCalculator />}

      {isLotSizeCalc && <LotSizeCalculator />}

      {isRrCalc && <RiskRewardCalculator />}

      {isJournalTool && <JournalToolBlock />}

      {isSessionChecker && <SessionCheckerBlock />}

      {keyTakeaways.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Key takeaways</p>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {keyTakeaways.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {user && completedAt && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-emerald-600">
            ✓ Completed on {new Date(completedAt).toLocaleDateString()}
          </p>
          <Link href="/learning" className="text-xs text-primary underline">
            Back to My Learning Path
          </Link>
        </div>
      )}

      {hasScoredQuiz || isPatternRecognition ? (
        <>
          {hasScoredQuiz && (
            <ScenarioQuizBlock
              lessonId={lesson.id}
              scenarios={scenarios}
              canSave={!!user}
              passingScore={lesson.passing_score}
            />
          )}
          {isPatternRecognition && patternConfig && (
            <PatternRecognitionBlock
              lessonId={lesson.id}
              patterns={patternConfig.patterns}
              lookalikes={patternConfig.lookalikes}
              rounds={patternConfig.rounds}
              canSave={!!user}
              passingScore={lesson.passing_score}
            />
          )}
          {!user && (
            <p className="text-sm text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">
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
