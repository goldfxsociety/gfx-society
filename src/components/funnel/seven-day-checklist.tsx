"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";

export type Day = { title: string; body: React.ReactNode; href?: string };

const DEFAULT_KEY = "gfx_gold_starter_7day";
const listeners = new Set<() => void>();
function read(KEY: string): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** 7-day checklist; ticks are stored only in this browser's localStorage. */
export function SevenDayChecklist({
  days,
  storageKey = DEFAULT_KEY,
  lessonLinkLabel = "Buksan ang lesson →",
}: {
  days: Day[];
  storageKey?: string;
  /** Per-card lesson link text; defaults to the Taglish copy. */
  lessonLinkLabel?: string;
}) {
  const KEY = storageKey;
  const raw = useSyncExternalStore(subscribe, () => read(KEY), () => "[]");
  let done: number[] = [];
  try {
    done = JSON.parse(raw);
  } catch {}
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((d) => d !== i) : [...done, i];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    listeners.forEach((l) => l());
  };
  return (
    <ol className="flex flex-col gap-3">
      {days.map((d, i) => (
        <li key={d.title} className="rounded-lg border p-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
            <input
              type="checkbox"
              className="size-6 shrink-0 accent-primary"
              checked={done.includes(i)}
              onChange={() => toggle(i)}
            />
            <span>{d.title}</span>
          </label>
          <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.body}</div>
          {d.href && (
            <Link href={d.href} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium underline">
              {lessonLinkLabel}
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}
