"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { gfxEvent } from "@/lib/analytics/events";

/**
 * Every outbound ACCM link goes through this component so clicks are counted:
 * - Vercel Web Analytics event (cookieless, no PII), so logged-out clicks count;
 * - analytics_events row ONLY when logged in (RLS: auth.uid() = user_id).
 * Fire-and-forget: never blocks or delays navigation. No anon inserts.
 */
export function trackAccmClick(path: string) {
  gfxEvent("accm_link_click", { path });
  void (async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession(); // local, no network
      const uid = data.session?.user.id;
      if (!uid) return;
      await supabase.from("analytics_events").insert({
        user_id: uid,
        event_name: "accm_link_click",
        metadata: { path },
      });
    } catch {
      // best-effort
    }
  })();
}

export function AccmLink({
  href,
  className,
  children,
  disabled = false,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  /** Gated (e.g. /accm self-check below 5/5): rendered with no href, so not focusable, nothing opens, no tracking. */
  disabled?: boolean;
}) {
  const path = usePathname() ?? "";
  // Gated: no href at all (not a link, not focusable, nothing to open), until enabled.
  if (disabled) {
    return (
      <a className={className} aria-disabled="true">
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="sponsored noopener noreferrer" className={className} onClick={() => trackAccmClick(path)}>
      {children}
    </a>
  );
}
