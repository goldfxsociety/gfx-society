"use client";
import { useEffect } from "react";

/**
 * Opens the <details id={id}> and scrolls to it when the URL fragment is #id (on load and on hash change), so a deep
 * link such as /accm#discord lands on the open Discord step instead of a closed expander.
 */
export function OpenOnHash({ id }: { id: string }) {
  useEffect(() => {
    const sync = () => {
      if (window.location.hash !== `#${id}`) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) el.open = true;
      el?.scrollIntoView({ block: "start" });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);
  return null;
}
