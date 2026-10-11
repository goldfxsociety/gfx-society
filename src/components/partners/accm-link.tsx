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

export function AccmLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const path = usePathname() ?? "";
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={className}
      onClick={() => trackAccmClick(path)}
    >
      {children}
    </a>
  );
}
