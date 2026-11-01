"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { JOIN_COPY as C } from "@/content/members-gate";
import { claimMembership, type JoinState } from "./actions";

export function JoinForm({ ibDisclosure }: { ibDisclosure: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(claimMembership, { result: "idle" });

  if (state.result === "matched") {
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="text-lg font-semibold">{C.matched}</p>
        <Link href="/system/members" className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          {C.matchedCta}
        </Link>
      </div>
    );
  }
  if (state.result === "no_match") {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p className="text-lg font-semibold">{C.noMatch}</p>
        <Link href="/academy" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
          {C.noMatchLearn}
        </Link>
        <a href="mailto:goldfx.society@gmail.com" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
          {C.noMatchContact}
        </a>
        <p className="text-sm text-muted-foreground">{C.noMatchMonthly}</p>
        <Link href="/accm" className="text-sm underline">
          {C.noMatchPartner}
        </Link>
        <p className="text-xs text-muted-foreground">{ibDisclosure}</p>
      </div>
    );
  }

  const msg =
    state.result === "consent_required" ? C.consentRequired
    : state.result === "rate_limited" ? C.rateLimited
    : state.result === "unverified_email" ? C.verifyEmailFirst
    : state.result === "error" ? C.error
    : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed">
        <strong>{C.consentLead}</strong> {C.consentBody}
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" className="mt-1 size-5" />
        <span>
          {C.consentCheckbox}{" "}
          <Link href="/privacy" className="underline">
            {C.privacyLink}
          </Link>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        {ibDisclosure} {C.consentAfter}
      </p>
      {msg && (
        <p className="text-sm text-destructive" role="alert">
          {msg}
        </p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {C.submit}
      </Button>
    </form>
  );
}
