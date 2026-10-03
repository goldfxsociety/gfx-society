"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { submitDiagnosticAnswer, skipDiagnosticQuestion } from "@/lib/diagnostic/submit-answer";
import { completeDiagnosticSession } from "@/lib/diagnostic/complete-session";
import { CandleSequenceCanvas } from "@/components/lesson-engine/blocks/candle-sequence-canvas";
import type { DiagnosticQuestionPublic } from "@/lib/diagnostic/types";

export function DiagnosticFlow({
  sessionId,
  questions,
}: {
  sessionId: string;
  questions: DiagnosticQuestionPublic[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const chosen = selected[question.id];

  async function advance() {
    if (isLast) {
      await completeDiagnosticSession(sessionId);
      router.push(`/diagnostic/${sessionId}/results`);
      return;
    }
    setIndex((i) => i + 1);
  }

  async function handleContinue() {
    setSubmitting(true);
    setError(null);
    try {
      if (chosen === undefined) {
        await skipDiagnosticQuestion(sessionId, question.id);
      } else {
        await submitDiagnosticAnswer(sessionId, question.id, chosen);
      }
      await advance();
    } catch {
      setError("Something went wrong saving that — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSelected((s) => {
      const copy = { ...s };
      delete copy[question.id];
      return copy;
    });
    setSubmitting(true);
    setError(null);
    try {
      await skipDiagnosticQuestion(sessionId, question.id);
      await advance();
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (index > 0) setIndex((i) => i - 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Question {index + 1} of {questions.length}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        {question.chart && (
          <div className="flex justify-center rounded-md border border-border bg-muted py-2">
            <CandleSequenceCanvas candles={question.chart} width={200} height={120} />
          </div>
        )}

        <p className="text-base font-medium">{question.question}</p>

        <div className="flex flex-col gap-2">
          {question.options.map((option, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected((s) => ({ ...s, [question.id]: i }))}
              disabled={submitting}
              className={cn(
                "rounded-md border px-4 py-2 text-left text-sm transition-colors hover:border-primary",
                chosen === i ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={handleBack} disabled={index === 0 || submitting}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={submitting}>
            Skip
          </Button>
          <Button onClick={handleContinue} disabled={submitting}>
            {submitting ? "Saving..." : isLast ? "See results" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
