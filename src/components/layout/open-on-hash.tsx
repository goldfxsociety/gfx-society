"use client";
import { useEffect } from "react";

/**
 * Opens the <details id={id}> and scrolls to it when the URL fragment is #id (on load and on hash change), so a deep
 * link such as /accm#discord lands on the open Discord step instead of a closed expander. Only then does keyboard focus
 * move to its native <summary> (no scroll jump, no focus trap); a normal load without the fragment never moves focus.
 */
export function OpenOnHash({ id }: { id: string }) {
  useEffect(() => {
    const sync = () => {
      if (window.location.hash !== `#${id}`) return;
      const el = document.getElementById(id);
      if (!el) return;
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ block: "start" });
      el.querySelector("summary")?.focus({ preventScroll: true });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);
  return null;
}
