"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { markLessonComplete } from "@/lib/progress/mark-complete";
import { recordAssessmentAttempt } from "@/lib/progress/assessment-attempts";
import { logEvent } from "@/lib/analytics/log-event";
import { Button } from "@/components/ui/button";
import { CandleSequenceCanvas } from "@/components/lesson-engine/blocks/candle-sequence-canvas";
import type { PatternDef } from "@/components/lesson-engine/blocks/pattern-intro-grid";
import { cn } from "cn";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PatternRecognitionBlock({
  lessonId,
  patterns,
  lookalikes = {},
  rounds = 5,
  canSave,
  passingScore,
}: {
  lessonId: string;
  patterns: PatternDef[];
  lookalikes?: Record<string, string[]>;
  rounds?: number;
  canSave: boolean;
  passingScore?: number | null;
}) {
  const router = useRouter();
  const order = useMemo(
    () => shuffle(patterns).slice(0, Math.min(rounds, patterns.length)),
    [patterns, rounds],
  );
  const [roundIdx, setRoundIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<PatternDef[]>([]);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attemptNumber, setAttemptNumber] = useState<number | null>(null);
  const hasThreshold = typeof passingScore === "number";

  useEffect(() => {
    if (canSave) void logEvent("quiz_started", lessonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = order[roundIdx];
  const options = useMemo(() => {
    if (!current) return [];
    const excluded = new Set([current.id, ...(lookalikes[current.id] ?? [])]);
    const distractors = shuffle(patterns.filter((p) => !excluded.has(p.id)))
      .slice(0, 3)
      .map((p) => p.name);
    return shuffle([current.name, ...distractors]);
  }, [current, patterns, lookalikes]);

  if (!current) return null;

  function handleSelect(name: string) {
    if (selected !== null) return;
    setSelected(name);
    if (name === current.name) {
      setScore((s) => s + 1);
    } else {
      setMissed((m) => [...m, current]);
    }
  }

  async function handleNext() {
    if (roundIdx + 1 < order.length) {
      setRoundIdx((i) => i + 1);
      setSelected(null);
      return;
    }

    setFinished(true);
    const pct = Math.round((score / order.length) * 100);
    const passed = !hasThreshold || pct >= (passingScore as number);

    if (canSave) {
      setSaving(true);
      const attemptNo = await recordAssessmentAttempt(lessonId, score, order.length, passed);
      setAttemptNumber(attemptNo);
      void logEvent(passed ? "quiz_passed" : "quiz_failed", lessonId, {
        score,
        total: order.length,
      });
      if (passed) {
        await markLessonComplete(lessonId);
        router.refresh();
      }
      setSaving(false);
    }
  }

  function handleRetry() {
    if (canSave) void logEvent("quiz_retried", lessonId);
    setRoundIdx(0);
    setSelected(null);
    setScore(0);
    setMissed([]);
    setFinished(false);
  }

  if (finished) {
    const pct = Math.round((score / order.length) * 100);
    const passed = !hasThreshold || pct >= (passingScore as number);

    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-lg font-semibold">
          {hasThreshold ? (passed ? "Passed — " : "Not quite — ") : "Quiz complete: "}
          {score}/{order.length} correct
          {hasThreshold ? ` (${pct}%)` : ""}
        </p>
        {hasThreshold && (
          <p className="text-xs text-muted-foreground">
            Passing score: {passingScore}%
            {attemptNumber ? ` · Attempt ${attemptNumber}` : ""}
          </p>
        )}
        {canSave ? (
          <p className="text-sm text-muted-foreground">
            {saving
              ? "Saving..."
              : passed
                ? "Progress saved ✓"
                : "Not saved as complete yet — review below and try again."}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Log in to save this result to your account.
          </p>
        )}

        {!passed && missed.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-left text-sm">
            <p className="font-semibold">Review these before retrying:</p>
            {missed.map((m, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.name}</span> — {m.tip}
              </p>
            ))}
          </div>
        )}

        {!passed && (
          <Button onClick={handleRetry} className="self-center">
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Pattern {roundIdx + 1} of {order.length}
      </p>
      <p className="text-base font-medium">🕯️ What pattern is this?</p>

      <div className="flex justify-center rounded-md border border-border bg-muted py-2">
        <CandleSequenceCanvas candles={current.ohlc} width={140} height={110} />
      </div>

      <div className="flex flex-col gap-2">
        {options.map((name) => {
          const isCorrect = name === current.name;
          const isChosen = name === selected;
          const answered = selected !== null;

          return (
            <button
              key={name}
              type="button"
              onClick={() => handleSelect(name)}
              disabled={answered}
              className={cn(
                "rounded-md border px-4 py-2 text-left text-sm transition-colors",
                !answered && "hover:border-primary",
                answered && isCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950",
                answered && isChosen && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-950",
                answered && !isCorrect && !isChosen && "opacity-60",
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="flex flex-col gap-3 rounded-md bg-muted p-3 text-sm">
          <p>
            {selected === current.name ? "✓ Correct!" : `Not quite — it's a ${current.name}.`}{" "}
            {current.tip}
          </p>
          <Button onClick={handleNext} className="self-start">
            {roundIdx + 1 < order.length ? "Next Pattern" : "See results"}
          </Button>
        </div>
      )}
    </div>
  );
}
