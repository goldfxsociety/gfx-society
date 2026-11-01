"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { formatPht } from "@/lib/training/time";
import { submitPlacement, type PlacementResult } from "./actions";

export function PlacementForm({ slug, questions }: { slug: string; questions: { q: string; options: string[] }[] }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [res, setRes] = useState<PlacementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const out = useRef<HTMLDivElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await submitPlacement(slug, answers.map((a) => a ?? -1));
    setBusy(false);
    setRes(r);
    requestAnimationFrame(() => out.current?.focus());
  }

  if (res && "passed" in res && res.passed) {
    return (
      <div ref={out} tabIndex={-1} aria-live="polite" className="flex flex-col gap-3">
        <p className="text-lg font-semibold">Pasado ka ✓{"score" in res ? ` (${res.score}/${res.total})` : ""}</p>
        <p className="text-sm">Bukas na ang Gold Advanced Setups para sa iyo.</p>
        <Link href={`/courses/${slug}`} className={cn(buttonVariants({ variant: "default" }), "min-h-11 w-full")}>
          Go to course →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {questions.map((q, qi) => (
        <fieldset key={qi} className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">
            {qi + 1}. {q.q}
          </legend>
          {q.options.map((o, oi) => (
            <label key={oi} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input
                type="radio"
                name={`p${qi}`}
                checked={answers[qi] === oi}
                onChange={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
              />
              {o}
            </label>
          ))}
        </fieldset>
      ))}
      <div ref={out} tabIndex={-1} aria-live="polite">
        {res && "error" in res && <p role="alert" className="text-sm text-red-300">Hindi na-save ang sagot mo. Subukan ulit.</p>}
        {res && "cooldown_until" in res && res.cooldown_until && (
          <p className="text-sm">
            {"score" in res ? `${res.score}/${res.total}. Kailangan ng 80% para pumasa. ` : ""}
            Puwede kang sumubok ulit pagkatapos ng {formatPht(res.cooldown_until)}.
          </p>
        )}
      </div>
      <Button type="submit" className="min-h-11 w-full" disabled={busy || Boolean(res && "cooldown_until" in res && res.cooldown_until)}>
        Submit answers
      </Button>
    </form>
  );
}
