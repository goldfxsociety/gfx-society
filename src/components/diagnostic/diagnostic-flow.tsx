"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { submitDiagnosticAnswer, skipDiagnosticQuestion } from "@/lib/diagnostic/submit-answer";
import { completeDiagnosticSession } from "@/lib/diagnostic/complete-session";
import { CandleSequenceCanvas } from "@/components/lesson-engine/blocks/candle-sequence-canvas";
import type { DiagnosticQuestionPublic } from "@/lib/diagnostic/types";
import { optionOrder } from "@/lib/diagnostic/option-order";

export function DiagnosticFlow({
  sessionId,
  questions,
  initialIndex = 0,
  initialSelected = {},
}: {
  sessionId: string;
  questions: DiagnosticQuestionPublic[];
  /** Resume point: first unanswered question (answers are saved server-side per question). */
  initialIndex?: number;
  initialSelected?: Record<string, number>;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(Math.min(initialIndex, questions.length - 1));
  const [selected, setSelected] = useState<Record<string, number>>(initialSelected);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  // `chosen` and everything submitted are ORIGINAL option indexes.
  const chosen = selected[question.id];
  const order = optionOrder(sessionId, question.id, question.options.length);

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
        {index === initialIndex && initialIndex > 0 && (
          <p className="text-sm text-primary">Welcome back! Tuloy tayo kung saan ka tumigil.</p>
        )}
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
        <p className="text-sm text-muted-foreground">
          No penalty kung hindi mo alam. Piliin ang best guess mo, o i-Skip.
        </p>

        <div className="flex flex-col gap-2">
          {order.map((i) => (
            <button
              key={`${question.id}-${i}`}
              type="button"
              onClick={() => setSelected((s) => ({ ...s, [question.id]: i }))}
              disabled={submitting}
              className={cn(
                "min-h-12 rounded-md border px-4 py-2 text-left text-base transition-colors hover:border-primary",
                chosen === i ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              {question.options[i]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={handleBack} disabled={index === 0 || submitting} className="h-11">
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={submitting} className="h-11">
            Skip
          </Button>
          <Button onClick={handleContinue} disabled={submitting} className="h-11 px-4">
            {submitting ? "Saving..." : isLast ? "See results" : "Continue"}
          </Button>
        </div>
      </div>
      {(index === 0 || index === initialIndex) && (
      <p className="text-center text-sm text-muted-foreground">
        Naka-save ang bawat sagot. Pwede kang tumigil at ituloy later.
      </p>
      )}
    </div>
  );
}
