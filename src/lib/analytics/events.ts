"use client";
import { track } from "@vercel/analytics";

// Funnel events (builder spec 08 §3). No personal data: only fixed labels and
// first-touch utm_* values. If custom events aren't available on the Vercel
// plan, or the script isn't loaded (e.g. locally), these are silent no-ops.
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
const STORE = "gfx_first_touch_utm";

/** Store first-touch utm_* from the current URL in sessionStorage (once per session). */
export function captureFirstTouchUtm() {
  try {
    if (sessionStorage.getItem(STORE)) return;
    const p = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = p.get(k);
      if (v) utm[k] = v.slice(0, 100);
    }
    if (Object.keys(utm).length) sessionStorage.setItem(STORE, JSON.stringify(utm));
  } catch {
    /* storage blocked: ignore */
  }
}

function firstTouch(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "{}");
  } catch {
    return {};
  }
}

/** Fire a Vercel Analytics custom event; optionally at most once per session. */
export function gfxEvent(name: string, props: Record<string, string> = {}, oncePerSession = false) {
  try {
    if (oncePerSession) {
      const key = `gfx_evt_${name}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    }
    track(name, { ...firstTouch(), ...props });
  } catch {
    /* no-op */
  }
}
