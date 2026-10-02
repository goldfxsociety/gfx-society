"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const REASONS = [
  { id: "support", label: "Bounced off support/resistance", planned: true },
  { id: "bos", label: "Break of Structure confirmation", planned: true },
  { id: "rsi", label: "RSI oversold/overbought signal", planned: true },
  { id: "plan", label: "Followed my trading plan exactly", planned: true },
  { id: "fomo", label: "FOMO — jumped in after a big move", planned: false },
];

type Direction = "buy" | "sell";
type Result = "win" | "loss";

export function JournalToolBlock() {
  const [direction, setDirection] = useState<Direction | null>(null);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; tone: "bullish" | "bearish" | "doji" } | null>(null);

  function handleSave() {
    if (!direction || !reasonId || !result) {
      setError("Pick a direction, a reason, and a result first.");
      setFeedback(null);
      return;
    }
    setError("");

    const reason = REASONS.find((r) => r.id === reasonId)!;
    let message: string;
    let tone: "bullish" | "bearish" | "doji";

    if (reason.planned && result === "win") {
      message = "This is exactly what you want more of — a plan-based entry that worked.";
      tone = "bullish";
    } else if (reason.planned && result === "loss") {
      message = "Still a good process — not every planned trade wins, and that's fine. Process over outcome.";
      tone = "doji";
    } else if (!reason.planned && result === "win") {
      message = "It worked this time, but don't let a lucky win convince you this is repeatable — the reason still wasn't plan-based.";
      tone = "doji";
    } else {
      message = "This is exactly the pattern your journal should catch and eliminate — an impulsive entry that lost.";
      tone = "bearish";
    }

    setFeedback({ message, tone });
  }

  const toneClass = {
    bullish: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950",
    bearish: "border-red-500 bg-red-50 dark:bg-red-950",
    doji: "border-amber-500 bg-amber-50 dark:bg-amber-950",
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <p className="text-sm font-semibold">📓 Mock Journal Entry</p>
      <p className="text-xs text-zinc-500">
        Pick a direction, a reason, and a result — the feedback depends on more than just win or loss.
      </p>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Direction</p>
        <div className="flex gap-2">
          <Button
            variant={direction === "buy" ? "default" : "outline"}
            size="sm"
            onClick={() => setDirection("buy")}
          >
            Buy
          </Button>
          <Button
            variant={direction === "sell" ? "default" : "outline"}
            size="sm"
            onClick={() => setDirection("sell")}
          >
            Sell
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Reason for Entry</p>
        <div className="flex flex-col gap-2">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReasonId(r.id)}
              className={cn(
                "rounded-md border px-4 py-2 text-left text-sm transition-colors hover:border-amber-400",
                reasonId === r.id && "border-amber-500 bg-amber-50 dark:bg-amber-950",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Result</p>
        <div className="flex gap-2">
          <Button
            variant={result === "win" ? "default" : "outline"}
            size="sm"
            onClick={() => setResult("win")}
          >
            Win
          </Button>
          <Button
            variant={result === "loss" ? "default" : "outline"}
            size="sm"
            onClick={() => setResult("loss")}
          >
            Loss
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {feedback && (
        <div className={`rounded-md border p-3 text-sm ${toneClass[feedback.tone]}`}>
          <p className="font-semibold">
            {direction?.toUpperCase()} · {REASONS.find((r) => r.id === reasonId)?.label} · {result?.toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{feedback.message}</p>
        </div>
      )}

      <Button onClick={handleSave} className="self-start">
        Save Journal Entry
      </Button>
    </div>
  );
}
