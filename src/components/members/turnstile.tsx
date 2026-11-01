"use client";

import Script from "next/script";
import { useEffect, useReducer, useRef } from "react";
import { AlertCircle } from "lucide-react";
import {
  CAPTCHA_FIELD,
  CAPTCHA_LOAD_ERROR,
  CAPTCHA_REFRESH_LABEL,
  CAPTCHA_TIMEOUT_MS,
  captchaReducer,
  initialCaptchaState,
  type CaptchaState,
} from "@/lib/auth/captcha";

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
 * Invisible Cloudflare Turnstile (Ben, P2-A option b), shared by /system/join, /signup and /login.
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset (onState then reports "off").
 * Managed mode, appearance "interaction-only": invisible unless Cloudflare needs a check. No copy.
 * Tokens are single-use: remount (change `key`) for every new request.
 * Browser failures (script blocked, widget error, expired, no token after 10s) report "error";
 * the form disables submit and shows <CaptchaError>. A later token reports "ok" again.
 */
export function Turnstile({ onState }: { onState?: (s: CaptchaState) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(captchaReducer, undefined, initialCaptchaState);
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  });
  useEffect(() => {
    onStateRef.current?.(state);
  }, [state]);

  useEffect(() => {
    if (!SITE_KEY) return;
    const t = setTimeout(() => dispatch({ type: "timeout" }), CAPTCHA_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  function mount() {
    if (!SITE_KEY || !box.current || !window.turnstile || box.current.dataset.mounted) return;
    box.current.dataset.mounted = "1";
    try {
      window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        appearance: "interaction-only",
        "response-field": false,
        callback: (token: string) => dispatch({ type: "token", token }),
        "expired-callback": () => dispatch({ type: "expired" }),
        "timeout-callback": () => dispatch({ type: "expired" }),
        "error-callback": () => dispatch({ type: "error" }),
      });
    } catch {
      dispatch({ type: "error" });
    }
  }

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={mount}
        onError={() => dispatch({ type: "load-failed" })}
      />
      <div ref={box} data-testid="turnstile" />
      <input type="hidden" name={CAPTCHA_FIELD} value={state.token} />
    </>
  );
}

/** Design spec: inline above submit, icon + text, role="alert", I-refresh text button (44px). */
export function CaptchaError({ id, show }: { id: string; show: boolean }) {
  if (!show) return null;
  return (
    <div id={id} role="alert" className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
      <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1">{CAPTCHA_LOAD_ERROR}</span>
      <button
        type="button"
        onClick={() => location.reload()}
        className="inline-flex min-h-11 items-center px-1 text-sm text-foreground underline"
      >
        {CAPTCHA_REFRESH_LABEL}
      </button>
    </div>
  );
}
