"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { NEXT_STEP_HREF } from "@/config/journey";
import { gfxEvent } from "@/lib/analytics/events";

export type NextStepLocation =
  | "home"
  | "start"
  | "gold_starter"
  | "lesson1"
  | "lesson_end"
  | "level_complete"
  | "academy_complete"
  | "community"
  | "go";

/** Internal link to the Academy next step (/accm, or /broker as fallback). Never links straight to Discord. */
export function NextStepLink({
  location,
  className,
  children,
}: {
  location: NextStepLocation;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={NEXT_STEP_HREF} className={className} onClick={() => gfxEvent("next_step_click", { location })}>
      {children}
    </Link>
  );
}
