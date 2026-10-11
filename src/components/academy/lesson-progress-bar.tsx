"use client";
import { useEffect, useRef, useState } from "react";

/**
 * In-page lesson progress bar + a slim 4px sticky copy that pins under the
 * sticky site header once the in-page bar scrolls out of view (GFX Design Q2).
 * The sticky copy is position:fixed (no layout shift), decorative (aria-hidden;
 * the in-page bar carries the progressbar semantics), pointer-events:none so it
 * never blocks taps, and fades only when motion is allowed.
 */
export function LessonProgressBar({ pos, total }: { pos: number; total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [top, setTop] = useState(0);
  const pct = total ? Math.round((pos / total) * 100) : 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const header = document.querySelector("header");
    const measure = () => setTop(header ? Math.round(header.getBoundingClientRect().height) : 0);
    measure();
    window.addEventListener("resize", measure);
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0 + (header?.getBoundingClientRect().height ?? 0)),
      { rootMargin: `-${header ? Math.round(header.getBoundingClientRect().height) : 0}px 0px 0px 0px` },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <>
      <div
        ref={ref}
        role="progressbar"
        aria-label={`Lesson ${pos} of ${total}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={pos}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div
        aria-hidden="true"
        data-testid="sticky-lesson-progress"
        className={`pointer-events-none fixed inset-x-0 z-30 h-1 bg-muted/60 motion-safe:transition-opacity ${stuck ? "opacity-100" : "opacity-0"}`}
        style={{ top }}
      >
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}
