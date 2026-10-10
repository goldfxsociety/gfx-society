"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { acceptReconsent } from "@/app/reconsent-actions";

/** localStorage key holding the time (ms) the user last chose "Later". */
const LATER_KEY = "gfx_reconsent_later_at";
const LATER_MS = 24 * 60 * 60 * 1000;

function laterIsActive(): boolean {
  try {
    const at = Number(window.localStorage.getItem(LATER_KEY) ?? 0);
    return Number.isFinite(at) && Date.now() - at < LATER_MS;
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

/**
 * Non-modal banner (no focus trap needed): sits above the bottom nav, never
 * blocks the page. Esc = Later. "Later" hides it for 24h (localStorage).
 */
export function ReconsentBanner() {
  // Hidden during SSR/hydration; on the client, hidden while "Later" is active.
  const snoozed = useSyncExternalStore(noopSubscribe, laterIsActive, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const agreeId = useId();
  const marketingId = useId();
  const ref = useRef<HTMLElement>(null);
  const visible = !snoozed && !dismissed;

  function later() {
    try {
      window.localStorage.setItem(LATER_KEY, String(Date.now()));
    } catch {
      /* private mode: just hide for this page view */
    }
    setDismissed(true);
  }

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") later();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  async function accept() {
    setSaving(true);
    setError(null);
    const res = await acceptReconsent({ agree, marketing });
    setSaving(false);
    if (res.ok) setDismissed(true);
    else setError(res.error);
  }

  if (!visible) return null;

  return (
    <section
      ref={ref}
      role="region"
      aria-labelledby={titleId}
      data-testid="reconsent-banner"
      className="fixed inset-x-0 bottom-16 z-30 mx-auto w-full max-w-2xl px-3"
    >
      <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-4 text-sm shadow-lg">
        <h2 id={titleId} className="font-semibold">
          We&apos;ve updated our Privacy Notice and Terms
        </h2>
        <p className="text-xs text-muted-foreground">
          Please review our{" "}
          <Link href="/privacy" className="underline" target="_blank">
            Privacy Notice
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline" target="_blank">
            Terms of Use
          </Link>
          . The Academy stays open either way.
        </p>
        <div className="flex items-start gap-2 text-xs">
          <input
            id={agreeId}
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            required
            aria-required="true"
            className="mt-0.5 h-6 w-6 shrink-0 accent-primary"
          />
          <label htmlFor={agreeId}>
            I agree to the Terms of Use and consent to GoldFX Society processing my
            data as described in the Privacy Notice. (Required)
          </label>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <input
            id={marketingId}
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0 accent-primary"
          />
          <label htmlFor={marketingId}>
            (Optional) Send me GFX Society community news, event invites and updates.
          </label>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={accept}
            disabled={!agree || saving}
            className="min-h-11 flex-1 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Accept"}
          </button>
          <button
            type="button"
            onClick={later}
            className="min-h-11 flex-1 rounded-md border border-border px-4 text-sm"
          >
            Later
          </button>
        </div>
      </div>
    </section>
  );
}
