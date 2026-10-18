"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { AccmLink } from "@/components/partners/accm-link";

const KEY = "gfx_accm_selfcheck";
const DAYS_30 = 30 * 24 * 60 * 60 * 1000;
const CODE = "bqqaoy";

export const SELF_CHECK = [
  "Natapos ko na ang GFX Academy, o kahit ang Level 6: Real-Money Discipline.",
  "Alam ko ang 1% rule, at lagi akong maglalagay ng stop loss.",
  "Pera lang na kaya kong mawala ang gagamitin ko, hindi pambayad ng bills, utang o emergency fund.",
  "Alam kong walang guaranteed profit, at pwede akong matalo.",
  "Ako mismo ang nag-check sa broker: licence para sa bansa ko, fees at terms.",
];

export function CodeChip() {
  const [copied, setCopied] = useState<"" | "ok" | "manual">("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CODE);
      setCopied("ok");
    } catch {
      setCopied("manual");
    }
    setTimeout(() => setCopied(""), 2000);
  };
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy invitation code ${CODE}`}
        className={cn(buttonVariants({ variant: "outline" }), "h-11 font-mono select-all")}
      >
        Code: {CODE} ⧉
      </button>
      <span aria-live="polite" className="text-xs text-muted-foreground">
        {copied === "ok" ? "Copied! ✓" : copied === "manual" ? "Long-press para i-copy" : ""}
      </span>
    </span>
  );
}

const noop = () => () => {};
function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function parseStored(raw: string | null): boolean[] {
  const empty = SELF_CHECK.map(() => false);
  if (!raw) return empty;
  try {
    const saved = JSON.parse(raw) as { t: boolean[]; at: number };
    // Ticks reset after 30 days.
    if (Date.now() - saved.at < DAYS_30 && Array.isArray(saved.t) && saved.t.length === SELF_CHECK.length) {
      return saved.t.map(Boolean);
    }
  } catch {
    // ignore bad data
  }
  return empty;
}

function saveTicks(t: boolean[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ t, at: Date.now() }));
  } catch {
    // storage blocked: ticks just won't persist
  }
}

export function AccmSelfCheck({ href, disclosure }: { href: string; disclosure: string }) {
  const raw = useSyncExternalStore(noop, readRaw, () => null);
  const stored = useMemo(() => parseStored(raw), [raw]);
  const [local, setLocal] = useState<boolean[] | null>(null);
  const ticks = local ?? stored;

  const toggle = (i: number) => {
    const next = ticks.map((v, j) => (j === i ? !v : v));
    setLocal(next);
    saveTicks(next);
  };

  const n = ticks.filter(Boolean).length;
  const ready = n === SELF_CHECK.length;
  const btn = cn(buttonVariants({ variant: "default" }), "h-12 flex-1 text-base");

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1">
        <legend className="sr-only">Quick self-check</legend>
        {SELF_CHECK.map((label, i) => (
          <label key={i} className="flex min-h-12 cursor-pointer items-start gap-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={ticks[i]}
              onChange={() => toggle(i)}
              className="mt-0.5 h-6 w-6 shrink-0 accent-primary"
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <p aria-live="polite" className="text-sm font-medium">
        {n} of 5 ✓
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <AccmLink href={href} disabled={!ready} className={cn(btn, !ready && "cursor-not-allowed opacity-50")}>
          Open cents account →
        </AccmLink>
        <CodeChip />
      </div>
      {!ready && <p className="text-xs text-muted-foreground">I-tick muna ang 5 sa taas.</p>}
      <p className="text-xs text-muted-foreground">
        Min deposit $50 · GCash, Maya, other e-wallets. Hindi kailangang lampasan.
      </p>
      <p className="text-xs text-muted-foreground">{disclosure}</p>
    </div>
  );
}
