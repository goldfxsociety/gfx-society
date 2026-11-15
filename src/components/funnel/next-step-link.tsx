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

/**
 * Internal next-step link that logs `next_step_click` with a fixed `location` label (no personal data). Default target
 * is the Academy next step (/accm, or /broker as fallback); `href` overrides it with another internal path (e.g. the
 * Join the Trading System door on /go). Never links straight to Discord.
 */
export function NextStepLink({
  location,
  className,
  children,
  href = NEXT_STEP_HREF,
}: {
  location: NextStepLocation;
  className?: string;
  children: ReactNode;
  href?: `/${string}`;
}) {
  return (
    <Link href={href} className={className} onClick={() => gfxEvent("next_step_click", { location })}>
      {children}
    </Link>
  );
}
