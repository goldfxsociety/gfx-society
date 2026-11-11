"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REQUEST_COPY as R } from "@/content/access-request";
import { JOIN_COPY as C } from "@/content/members-gate";
import { ACCM_CONFIRM_MAIL_LIVE } from "@/lib/members/access-request";
import { joinConsent, submitAccessRequest, type JoinState, type RequestState } from "./actions";
import { TransferHelp } from "./transfer-help";

export type JoinRequestView = { status: "pending" | "awaiting_email_confirm" | "matched"; submitted: string; ibName: string | null };

type Props = {
  /** Safe relative deep link to land on after a match ("" = /training). */
  next: string;
  /** join-v2 consent already on file: show it as agreed, don't ask to tick again (spec §4.2). */
  consentRecorded: boolean;
  /** The logged-in, confirmed Academy email (read-only text in the request form). */
  academyEmail: string;
  /** The user's active request, if any (pending / awaiting_email_confirm). */
  request: JoinRequestView | null;
  /** "Dec 1, 2026": the next 1st in Asia/Manila, computed on the server. */
  nextFirst: string;
};

const link = "inline-flex min-h-11 items-center self-start py-2 text-left text-sm underline";

/** Logged-in, not-yet-member: consent + verify, then (no_match) the request form and the optional help. */
export function JoinForm({ next, consentRecorded, academyEmail, request, nextFirst }: Props) {
  const [verify, verifyAction, verifying] = useActionState<JoinState, FormData>(joinConsent, { result: "idle" });
  const [sent, requestAction, sending] = useActionState<RequestState, FormData>(submitAccessRequest, { result: "idle" });
  const [consent, setConsent] = useState(consentRecorded);
  const [formOpen, setFormOpen] = useState(false);

  const submitted = sent.result === "pending" || sent.result === "awaiting_email_confirm";
  const active = !submitted && request && request.status !== "matched" ? request : null;
  const noMatch = verify.result === "no_match" || Boolean(active) || submitted || sent.result !== "idle";
  // One gold CTA: Verify until the request form is open; none while a request is waiting.
  const showVerify = !(noMatch && (formOpen || active || submitted));

  const verifyMsg =
    verify.result === "consent_required" ? C.consentRequired
    : verify.result === "unverified_email" ? C.unverifiedEmail
    : verify.result === "rate_limited" ? C.rateLimited
    : verify.result === "error" ? C.error
    : null;

  return (
    <div className="flex flex-col gap-4">
      {showVerify && (
        <form action={verifyAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <p className="text-sm">{C.loggedInBody}</p>
          <p className="text-sm leading-relaxed">
            <strong>{C.consentLead}</strong> {C.consentBody}
          </p>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="consent"
              className="mt-1 size-5 shrink-0"
              checked={consent}
              disabled={consentRecorded}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              {C.consentCheckbox}{" "}
              <Link href="/privacy" className="underline inline-flex min-h-11 items-center py-2">
                {C.privacyLink}
              </Link>
            </span>
          </label>
          {verifyMsg && (
            <p className="text-sm text-destructive" role="alert">
              {verifyMsg}
            </p>
          )}
          <Button type="submit" className="h-11 w-full" disabled={verifying || !consent}>
            {C.submit}
          </Button>
        </form>
      )}

      {noMatch && (
        <div className="flex flex-col gap-3">
          {!active && !submitted && <p className="text-sm">{C.notVerified}</p>}
          <div role="status" className="text-sm empty:hidden">
            {sent.result === "pending" ? R.submittedPending
              : sent.result === "awaiting_email_confirm" ? R.submittedAwaiting
              : active && !formOpen ? (active.status === "awaiting_email_confirm" ? R.submittedAwaiting : R.activeRequest(active.submitted, nextFirst))
              : ""}
          </div>
          {!submitted && (
            <button
              type="button"
              aria-expanded={formOpen}
              aria-controls="access-request-form"
              onClick={() => setFormOpen((v) => !v)}
              className={`${link} text-muted-foreground`}
            >
              {active ? R.updateLink : R.openLink}
            </button>
          )}
          {!submitted && formOpen && (
            <RequestForm
              action={requestAction}
              state={sent}
              pending={sending}
              next={next}
              academyEmail={academyEmail}
              ibName={active?.ibName ?? ""}
            />
          )}
          <Link href="/accm" className={`${link} text-muted-foreground`}>
            {R.noAccmLink}
          </Link>
          <TransferHelp />
          <Link href="/academy" className={link}>
            {C.notVerifiedAcademyLink}
          </Link>
        </div>
      )}
    </div>
  );
}

function RequestForm({
  action,
  state,
  pending,
  next,
  academyEmail,
  ibName,
}: {
  action: (fd: FormData) => void;
  state: RequestState;
  pending: boolean;
  next: string;
  academyEmail: string;
  ibName: string;
}) {
  const accmRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const r = state.result;
  const accmErr = r === "invalid_email" ? R.invalidEmail : r === "same_email" ? R.sameEmail : null;
  const consentErr = r === "consent_required" ? R.consentRequired : null;
  const formErr =
    r === "rate_limited" ? R.rateLimited : r === "unverified_email" ? C.unverifiedEmail : r === "error" ? C.error : null;

  // Focus moves to the first error (spec §9).
  useEffect(() => {
    (accmErr ? accmRef.current : consentErr ? consentRef.current : formErr ? alertRef.current : null)?.focus();
  }, [state, accmErr, consentErr, formErr]);

  return (
    <form id="access-request-form" action={action} noValidate className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <input type="hidden" name="next" value={next} />
      <h2 className="text-lg font-semibold">{R.heading}</h2>
      <p className="text-sm leading-relaxed">{R.intro}</p>
      <div className="flex flex-col gap-1">
        <p id="ar-academy-label" className="text-sm font-medium">
          {R.academyEmailLabel}
        </p>
        <p aria-labelledby="ar-academy-label" className="text-base break-all">
          {academyEmail}
        </p>
      </div>
      {ACCM_CONFIRM_MAIL_LIVE && (
        <div className="flex flex-col gap-1">
          <label htmlFor="ar-accm" className="text-sm font-medium">
            {R.accmEmailLabel}
          </label>
          <Input
            ref={accmRef}
            id="ar-accm"
            name="accm_email"
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={254}
            aria-invalid={Boolean(accmErr)}
            aria-describedby={accmErr ? "ar-accm-help ar-accm-err" : "ar-accm-help"}
          />
          <p id="ar-accm-help" className="text-xs text-muted-foreground">
            {R.accmEmailHelper}
          </p>
          {accmErr && (
            <p id="ar-accm-err" className="text-sm text-destructive">
              {accmErr}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="ar-ib" className="text-sm font-medium">
          {R.ibNameLabel}
        </label>
        <Input id="ar-ib" name="ib_name" maxLength={60} autoComplete="off" defaultValue={ibName} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            ref={consentRef}
            type="checkbox"
            name="request_consent"
            className="mt-1 size-5 shrink-0"
            aria-invalid={Boolean(consentErr)}
            aria-describedby={consentErr ? "ar-consent-err" : undefined}
          />
          <span>
            {R.consent}{" "}
            <Link href="/privacy" className="underline inline-flex min-h-11 items-center py-2">
              {R.privacyLink}
            </Link>
          </span>
        </label>
        {consentErr && (
          <p id="ar-consent-err" className="text-sm text-destructive">
            {consentErr}
          </p>
        )}
      </div>
      {formErr && (
        <p ref={alertRef} tabIndex={-1} role="alert" className="text-sm text-destructive">
          {formErr}
        </p>
      )}
      <Button type="submit" className="h-11 w-full md:w-auto" disabled={pending}>
        {R.submit}
      </Button>
    </form>
  );
}
