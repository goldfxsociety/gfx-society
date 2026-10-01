"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { markLessonComplete } from "@/lib/progress/mark-complete";
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
}: {
  lessonId: string;
  patterns: PatternDef[];
  lookalikes?: Record<string, string[]>;
  rounds?: number;
  canSave: boolean;
}) {
  const router = useRouter();
  const order = useMemo(
    () => shuffle(patterns).slice(0, Math.min(rounds, patterns.length)),
    [patterns, rounds],
  );
  const [roundIdx, setRoundIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (name === current.name) setScore((s) => s + 1);
  }

  async function handleNext() {
    if (roundIdx + 1 < order.length) {
      setRoundIdx((i) => i + 1);
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
      <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-800">
        <p className="text-lg font-semibold">
          Quiz complete: {score}/{order.length} correct
        </p>
        {canSave ? (
          <p className="text-sm text-zinc-500">
            {saving ? "Saving your progress..." : "Progress saved ✓"}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">
            Log in to save this result to your account.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Pattern {roundIdx + 1} of {order.length}
      </p>
      <p className="text-base font-medium">🕯️ What pattern is this?</p>

      <div className="flex justify-center rounded-md border border-zinc-200 bg-zinc-50 py-2 dark:border-zinc-800 dark:bg-zinc-900">
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
                !answered && "hover:border-amber-400",
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
        <div className="flex flex-col gap-3 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
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
