"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Invisible Cloudflare Turnstile (Ben, P2-A option b). Renders nothing when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so the flow works exactly as before.
 * Managed mode with appearance "interaction-only": invisible unless Cloudflare needs a check.
 * No UI copy. The token goes in a hidden "cf-turnstile-response" input; tokens are single-use,
 * so mount a fresh instance per request (key it on the request state).
 */
export function Turnstile() {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!SITE_KEY || !ready || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, {
      sitekey: SITE_KEY,
      appearance: "interaction-only",
      "response-field": false,
      callback: (t: string) => setToken(t),
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""), // the server shows the neutral screen and logs it
    });
    return () => window.turnstile?.remove(id);
  }, [ready]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={box} />
      <input type="hidden" name="cf-turnstile-response" value={token} />
    </>
  );
}
