"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { JOIN_COPY as C } from "@/content/members-gate";
import { joinConsent, type JoinState } from "./actions";

/** Logged-in, not-yet-member consent step. The DB (record_member_consent) decides; messages stay neutral. */
export function JoinForm() {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinConsent, { result: "idle" });
  const [consent, setConsent] = useState(false);

  const msg =
    state.result === "consent_required" ? C.consentRequired
    : state.result === "no_match" ? C.notVerified
    : state.result === "unverified_email" ? C.unverifiedEmail
    : state.result === "rate_limited" ? C.rateLimited
    : state.result === "error" ? C.error
    : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm">{C.loggedInBody}</p>
      <p className="text-sm leading-relaxed">
        <strong>{C.consentLead}</strong> {C.consentBody}
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="consent"
          className="mt-1 size-5"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          {C.consentCheckbox}{" "}
          <Link href="/privacy" className="underline inline-flex min-h-11 items-center py-2">
            {C.privacyLink}
          </Link>
        </span>
      </label>
      {msg && (
        <div className="flex flex-col items-start gap-1">
          <p className="text-sm text-destructive" role="alert">
            {msg}
          </p>
          {state.result === "no_match" && (
            <Link href="/academy" className="text-sm underline inline-flex min-h-11 items-center py-2">
              {C.notVerifiedAcademyLink}
            </Link>
          )}
        </div>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending || !consent}>
        {C.submit}
      </Button>
    </form>
  );
}
