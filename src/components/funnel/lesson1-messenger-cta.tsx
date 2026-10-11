"use client";
import { useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { MessengerLink } from "@/components/funnel/messenger-link";
import { captureFirstTouchUtm, gfxEvent } from "@/lib/analytics/events";

/** Variant flag (spec 08 §2): switch to "b" here; no per-visitor randomisation. */
export const LESSON1_CTA_VARIANT: "a" | "b" = "a";

/** End-of-Lesson-1 Messenger CTA (copy: funnel draft 06). */
export function Lesson1MessengerCta() {
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

  const a = LESSON1_CTA_VARIANT === "a";
  return (
    <section
      ref={ref}
      aria-labelledby="lesson1-cta-heading"
      className="mt-4 w-full rounded-xl border-2 border-primary/40 bg-primary/5 p-5"
    >
      <h2 id="lesson1-cta-heading" className="text-lg font-semibold">
        {a ? "Tapos mo na ang Lesson 1! 🎉 Ano ang natutunan mo?" : "Hindi mo kailangang matuto mag-isa."}
      </h2>
      {a ? (
        <p className="mt-2 text-sm leading-relaxed">
          The fastest way to learn? I-explain mo sa iba. Join the free GFX Society Messenger community at i-post ang
          Lesson 1 takeaway mo sa <strong>Start Here</strong>. Isang sentence lang, okay na. Example: &quot;Ang XAUUSD
          ay price ng 1 troy ounce ng gold in US dollars.&quot;
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed">
          Sa GFX Society community, sabay-sabay nag-aaral ang mga Pinoy na nagsisimula pa lang sa Gold. Unang hakbang:
          i-post sa <strong>Start Here</strong> ang isang bagay na natutunan mo sa Lesson 1, kahit tanong pa lang.
          Walang tanong na &quot;too basic.&quot;
        </p>
      )}
      <MessengerLink
        location="lesson1_end"
        variant={LESSON1_CTA_VARIANT}
        className={cn(buttonVariants({ size: "lg" }), "mt-4 min-h-12 w-full sm:w-auto")}
      >
        {a ? "Join sa Free Community →" : "Join GFX Society sa Messenger →"}
        <span className="sr-only"> (bubukas sa bagong tab)</span>
      </MessengerLink>
      <p className="mt-2 text-xs text-muted-foreground">
        {a
          ? "Free. Bubukas sa Messenger. Education lang ito: no signals, walang binebenta. Demo muna bago live."
          : "Free community · Bubukas sa bagong tab · Process ang pinag-uusapan, hindi P&L. Trading involves real risk of loss; education only, not financial advice."}
      </p>
    </section>
  );
}
