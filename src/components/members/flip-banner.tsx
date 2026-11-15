"use client";

import { useEffect, useState } from "react";

/**
 * One-time "Linked na ang ACCM account mo." banner (explorer-linked-tiers-spec §2.1). No websocket, no email, no
 * server state: this device remembers that it saw the Explorer / pending side (localStorage, a tier word only, no
 * personal data). The first Linked /training load after that shows the banner once and clears the marker.
 */
const KEY = "gfx_tier_seen";

export function markExplorerSeen() {
  try {
    window.localStorage.setItem(KEY, "explorer");
  } catch {
    /* storage blocked: no banner, nothing else changes */
  }
}

export function ExplorerSeen() {
  useEffect(() => markExplorerSeen(), []);
  return null;
}

export function FlipBanner({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "explorer") {
        window.localStorage.setItem(KEY, "linked");
        queueMicrotask(() => setShow(true)); // after hydration; server HTML never has the banner
      }
    } catch {
      /* storage blocked */
    }
  }, []);
  if (!show) return null;
  return (
    <p role="status" data-testid="flip-banner" className="rounded-lg border border-green-500/50 p-3 text-sm">
      {text}
    </p>
  );
}
