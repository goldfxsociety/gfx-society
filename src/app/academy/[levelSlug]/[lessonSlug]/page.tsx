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
  const scenarioConfig = isScenarioQuiz
    ? (lesson.interactive_config as {
        scenarios: ScenarioQuizScenario[];
        introConcepts?: ConceptDef[];
      } | null)
    : null;
  const scenarios = scenarioConfig?.scenarios ?? [];
  const introConcepts = scenarioConfig?.introConcepts;

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
        className="text-sm text-muted-foreground underline"
      >
        ← Back to {level.title}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>

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

      {isScenarioQuiz && introConcepts && (
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
        <p className="text-sm font-medium text-emerald-600">
          ✓ Completed on {new Date(completedAt).toLocaleDateString()}
        </p>
      )}

      {isScenarioQuiz || isPatternRecognition ? (
        <>
          {isScenarioQuiz && (
            <ScenarioQuizBlock
              lessonId={lesson.id}
              scenarios={scenarios}
              canSave={!!user}
            />
          )}
          {isPatternRecognition && patternConfig && (
            <PatternRecognitionBlock
              lessonId={lesson.id}
              patterns={patternConfig.patterns}
              lookalikes={patternConfig.lookalikes}
              rounds={patternConfig.rounds}
              canSave={!!user}
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
