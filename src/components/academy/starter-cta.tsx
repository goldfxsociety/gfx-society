"use client";
import { gfxEvent } from "@/lib/analytics/events";

/** In-page anchor to the 7-day checklist (EN Starter Kit hero CTA). */
export function StarterCta({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <a href="#checklist" className={className} onClick={() => gfxEvent("starter_cta_click", { location: "gold_starter_en" })}>
      {children}
    </a>
  );
}
