"use client";
import type { ReactNode } from "react";
import { DISCORD_INVITE_URL } from "@/config/journey";
import { gfxEvent } from "@/lib/analytics/events";

/** The only outbound Discord link on the site (rendered on /accm and /broker only). Hidden when the invite is null. */
export function DiscordApplyLink({ page, className, children }: { page: "accm" | "broker"; className?: string; children: ReactNode }) {
  if (!DISCORD_INVITE_URL) return null;
  return (
    <a
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => gfxEvent("discord_apply_click", { page })}
    >
      {children}
      <span className="sr-only"> (bubukas sa bagong tab)</span>
    </a>
  );
}
