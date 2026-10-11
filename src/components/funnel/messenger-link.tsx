"use client";
import { MESSENGER_COMMUNITY_URL } from "@/config/academy";
import { gfxEvent } from "@/lib/analytics/events";

export function MessengerLink({
  location,
  variant,
  className,
  children,
}: {
  location: "lesson1_end" | "gold_starter";
  variant?: "a" | "b";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={MESSENGER_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => gfxEvent("messenger_cta_click", { location, ...(variant ? { variant } : {}) })}
    >
      {children}
    </a>
  );
}
