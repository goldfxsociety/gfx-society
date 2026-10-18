"use client";
import { useEffect, useRef } from "react";
import { captureFirstTouchUtm, gfxEvent } from "@/lib/analytics/events";

/** End-of-Lesson-1 card: reflection prompt only. The gold "Next lesson →" in LessonNav stays the primary. */
export function Lesson1EndCard() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    captureFirstTouchUtm();
    const fromStarter = document.referrer.includes("/academy/gold-starter");
    gfxEvent("lesson1_start", { entry_path: fromStarter ? "gold_starter" : "direct" }, true);
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.intersectionRatio >= 0.5)) {
          gfxEvent("lesson1_complete", { method: "scroll" }, true);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby="lesson1-end-heading"
      className="mt-4 w-full rounded-xl border-2 border-primary/40 bg-primary/5 p-5"
    >
      <h2 id="lesson1-end-heading" className="text-lg font-semibold">
        Tapos mo na ang Lesson 1! 🎉
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        Isulat mo in one sentence ang natutunan mo. Halimbawa: &quot;Ang XAUUSD ay price ng 1 troy ounce ng gold in US
        dollars.&quot;
      </p>
    </section>
  );
}
