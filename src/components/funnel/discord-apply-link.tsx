"use client";
import type { ReactNode } from "react";
import { DISCORD_INVITE_URL } from "@/config/journey";
import { gfxEvent } from "@/lib/analytics/events";

/** The only outbound Discord invite helper on the site (/accm and the member-home Signals card on /training). Hidden when the invite is null. /broker already dropped Discord. */
/** `lang="en"` on /en pages: English screen-reader hint. */
export function DiscordApplyLink({
  page,
  className,
  children,
  lang = "tl",
  testId,
}: {
  page: "accm" | "broker" | "training";
  className?: string;
  children: ReactNode;
  lang?: "tl" | "en";
  testId?: string;
}) {
  if (!DISCORD_INVITE_URL) return null;
  return (
    <a
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-testid={testId}
      onClick={() => gfxEvent("discord_apply_click", { page })}
    >
      {children}
      <span className="sr-only">{lang === "en" ? " (opens in a new tab)" : " (bubukas sa bagong tab)"}</span>
    </a>
  );
}
