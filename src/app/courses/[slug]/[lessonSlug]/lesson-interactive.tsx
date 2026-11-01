"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setPracticeDone, submitQuiz } from "./actions";

type Q = { q: string; options: string[] };

export function LessonInteractive({
  lessonId,
  quiz,
  practiceTask,
  initialPractice,
}: {
  lessonId: string;
  quiz: Q[] | null;
  practiceTask: string;
  initialPractice: boolean;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => (quiz ?? []).map(() => null));
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean; explains: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [practice, setPractice] = useState(initialPractice);
  const [live, setLive] = useState("");

  async function check() {
    setErr(null);
    const r = await submitQuiz(lessonId, answers.map((a) => a ?? -1));
    if ("error" in r) setErr("Hindi na-save ang sagot mo. Subukan ulit.");
    else {
      setResult(r);
      setLive(`Score ${r.score} of ${r.total}. Na-save ang progress mo.`);
    }
  }

  async function togglePractice(v: boolean) {
    setPractice(v);
    const r = await setPracticeDone(lessonId, v);
    if (!r.ok) {
      setPractice(!v);
      setErr("Hindi na-save ang progress mo. Subukan ulit.");
    } else setLive("Na-save ang progress mo.");
  }

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      {quiz && quiz.length > 0 && (
        <section aria-labelledby="quiz-h" className="flex flex-col gap-3">
          <h2 id="quiz-h" className="text-lg font-semibold">Quick quiz</h2>
          {quiz.map((q, qi) => (
            <fieldset key={qi} className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">
                {qi + 1}. {q.q}
              </legend>
              {q.options.map((o, oi) => (
                <label key={oi} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm">
                  <input
                    type="radio"
                    name={`q${qi}`}
                    checked={answers[qi] === oi}
                    onChange={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
                  />
                  {o}
                </label>
              ))}
              {result?.explains?.[qi] && <p className="text-sm text-muted-foreground">{result.explains[qi]}</p>}
            </fieldset>
          ))}
          <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => void check()}>
            Check answers
          </Button>
          {result && (
            <p className="text-sm">
              {result.score} / {result.total} {result.passed ? "· Passed ✓" : "· Kailangan ng 80% para pumasa. Subukan ulit."}
            </p>
          )}
        </section>
      )}
      {practiceTask && (
        <section aria-labelledby="practice-h" className="flex flex-col gap-2">
          <h2 id="practice-h" className="text-lg font-semibold">Practice task</h2>
          <p className="text-sm">{practiceTask}</p>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={practice} onChange={(e) => void togglePractice(e.target.checked)} />
            Tapos ko na ang practice task
          </label>
        </section>
      )}
      {err && (
        <p role="alert" className="text-sm text-red-300">
          {err}
        </p>
      )}
    </>
  );
}
