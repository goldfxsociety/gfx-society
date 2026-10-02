"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markLessonComplete } from "@/lib/progress/mark-complete";
import { Button } from "@/components/ui/button";
import { CandleSequenceCanvas } from "@/components/lesson-engine/blocks/candle-sequence-canvas";
import type { OHLC } from "@/lib/candlestick";
import { cn } from "cn";

export type ScenarioQuizScenario = {
  icon?: string;
  chart?: OHLC[];
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export function ScenarioQuizBlock({
  lessonId,
  scenarios,
  canSave,
}: {
  lessonId: string;
  scenarios: ScenarioQuizScenario[];
  canSave: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  const scenario = scenarios[index];
  const isLast = index === scenarios.length - 1;

  function handleSelect(optionIndex: number) {
    if (selected !== null) return; // already answered this round
    setSelected(optionIndex);
    if (optionIndex === scenario.correctIndex) {
      setScore((s) => s + 1);
    }
  }

  async function handleNext() {
    if (!isLast) {
      setIndex((i) => i + 1);
      setSelected(null);
      return;
    }

    setFinished(true);
    if (canSave) {
      setSaving(true);
      await markLessonComplete(lessonId);
      setSaving(false);
      router.refresh();
    }
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-lg font-semibold">
          Quiz complete: {score}/{scenarios.length} correct
        </p>
        {canSave ? (
          <p className="text-sm text-muted-foreground">
            {saving ? "Saving your progress..." : "Progress saved ✓"}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Log in to save this result to your account.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Scenario {index + 1} of {scenarios.length}
      </p>
      {scenario.chart && (
        <div className="flex justify-center rounded-md border border-border bg-muted py-2">
          <CandleSequenceCanvas candles={scenario.chart} width={200} height={120} />
        </div>
      )}

      <p className="text-base font-medium">
        {scenario.icon} {scenario.question}
      </p>

      <div className="flex flex-col gap-2">
        {scenario.options.map((option, i) => {
          const isCorrect = i === scenario.correctIndex;
          const isChosen = i === selected;
          const answered = selected !== null;

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(i)}
              disabled={answered}
              className={cn(
                "rounded-md border px-4 py-2 text-left text-sm transition-colors",
                !answered && "hover:border-primary",
                answered && isCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950",
                answered && isChosen && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-950",
                answered && !isCorrect && !isChosen && "opacity-60",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="flex flex-col gap-3 rounded-md bg-muted p-3 text-sm">
          <p>{scenario.explanation}</p>
          <Button onClick={handleNext} className="self-start">
            {isLast ? "See results" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}
