"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { NEXT_STEP_HREF } from "@/config/journey";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import { gfxEvent } from "@/lib/analytics/events";

type Location = "lesson_end" | "level_complete" | "lesson1" | "next_step";
const KEY = "gfx_discord_reminder_hidden_until";
const DAYS_30 = 30 * 24 * 60 * 60 * 1000;
const noop = () => () => {};
function readHidden(): boolean {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) > Date.now();
  } catch {
    return false; // storage blocked: show it; dismiss works for this session only
  }
}

/**
 * Gentle "Discord after ACCM" reminder. Outline style, never gold, never sticky, never a modal.
 * Card variant is dismissible for 30 days (site-wide). Inline variant (Lesson 1) is not dismissible.
 * At most one per page: the lesson page renders exactly one slot (Lesson 1 inline, otherwise one card).
 */
export function DiscordAfterAccmReminder({ location, variant }: { location: Location; variant: "card" | "inline" }) {
  // Client-only: renders nothing on the server and before hydration, so dismissed users never see a flash.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const storedHidden = useSyncExternalStore(noop, readHidden, () => true);
  const [dismissed, setDismissed] = useState(false);

  if (!mounted) return null;
  if (variant === "card" && (storedHidden || dismissed)) return null;

  const onNext = () => gfxEvent("next_step_click", { location });

  if (variant === "inline") {
    return (
      <div data-reminder="inline" className="mt-3 w-full text-sm text-muted-foreground">
        <p>
          May Discord community kami pagka-register mo sa ACCM.{" "}
          <Link href={NEXT_STEP_HREF} onClick={onNext} className="inline-flex min-h-11 items-center font-medium text-foreground underline">
            Tingnan kung paano →
          </Link>
        </p>
        <p className="text-xs">{IB_DISCLOSURE_TEXT}</p>
      </div>
    );
  }

  const dismiss = () => {
    setDismissed(true);
    gfxEvent("discord_reminder_dismiss", { location });
    try {
      localStorage.setItem(KEY, String(Date.now() + DAYS_30));
    } catch {
      // session-only dismiss
    }
  };

  return (
    <aside data-reminder="card" className="relative mt-4 w-full rounded-xl border border-border bg-card p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Itago muna ito"
        className="absolute top-1 right-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <p className="pr-10 text-base font-semibold">Next step: guided training sa partner community namin</p>
      <p className="mt-1 text-sm text-muted-foreground">
        May Discord community kami na puwede mong salihan pagka-register mo sa ACCM. Walang rush: tuloy lang sa lessons
        hangga&apos;t kailangan mo.
      </p>
      <Link
        href={NEXT_STEP_HREF}
        onClick={onNext}
        className={cn(buttonVariants({ variant: "outline" }), "mt-3 h-11 w-full")}
      >
        Tingnan ang steps →
      </Link>
      <p className="mt-2 text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
    </aside>
  );
}
