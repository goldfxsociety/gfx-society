"use client";

import { useState } from "react";
import { setCapstoneItems } from "./actions";

/** B10: self-check rubric only. All ticked = capstone done. No submission, no review queue. */
export function CapstoneChecklist({ courseId, items, initial }: { courseId: string; items: string[]; initial: number[] }) {
  const [ticked, setTicked] = useState<Set<number>>(new Set(initial));
  const [live, setLive] = useState("");
  async function toggle(i: number, on: boolean) {
    const next = new Set(ticked);
    if (on) next.add(i);
    else next.delete(i);
    setTicked(next);
    const r = await setCapstoneItems(courseId, [...next]);
    if (!r.ok) {
      setTicked(ticked);
      setLive("Hindi na-save. Subukan ulit.");
    } else setLive(r.done ? "Capstone done ✓" : "Na-save ang progress mo.");
  }
  return (
    <>
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i}>
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input type="checkbox" checked={ticked.has(i)} onChange={(e) => void toggle(i, e.target.checked)} />
              {it}
            </label>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="text-sm">
        {ticked.size === items.length ? "Capstone done ✓" : `${ticked.size} of ${items.length}`} {live && `· ${live}`}
      </p>
    </>
  );
}
