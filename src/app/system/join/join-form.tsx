"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { CaptchaError, Turnstile } from "@/components/members/turnstile";
import { captchaBlocksSubmit, initialCaptchaState, type CaptchaState } from "@/lib/auth/captcha";
import { Button } from "@/components/ui/button";
import { JOIN_COPY as C } from "@/content/members-gate";
import { joinStep, type JoinState } from "./actions";

const COOLDOWN_S = 60;

export function JoinForm() {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinStep, { step: "email", email: "", result: "idle" });
  const [consent, setConsent] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Browser-side Turnstile status (flag off: always "off", nothing changes).
  const [captcha, setCaptcha] = useState<CaptchaState>(initialCaptchaState);
  const captchaBlocked = captchaBlocksSubmit(captcha);
  const captchaFailed = captcha.status === "error";

  // 60s resend cooldown from the last accepted request (server-side rate limits still apply).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const cooldown = state.sentAt ? Math.max(0, COOLDOWN_S - Math.floor((now - state.sentAt) / 1000)) : 0;

  const msg =
    state.result === "consent_required" ? C.consentRequired
    : state.result === "invalid_email" ? C.invalidEmail
    : state.result === "wrong_code" ? C.wrongCode
    : state.result === "expired_code" ? C.expiredCode
    : state.result === "not_verified" ? C.notVerified
    : state.result === "error" ? C.error
    : null;
  const alert = msg && (
    <div className="flex flex-col items-start gap-1">
      <p className="text-sm text-destructive" role="alert">
        {msg}
      </p>
      {state.result === "not_verified" && (
        <Link href="/academy" className="text-sm underline inline-flex min-h-11 items-center py-2">
          {C.notVerifiedAcademyLink}
        </Link>
      )}
    </div>
  );
  // a11y: the ticking countdown is visual only; this sr-only line announces twice (cooldown start, Resend available).
  const announce = !state.sentAt ? "" : cooldown > 0 ? C.resendIn(COOLDOWN_S) : C.resendReady;
  const liveRegion = (
    <p className="sr-only" aria-live="polite">
      {announce}
    </p>
  );

  const links = (
    <div className="flex flex-col items-start text-sm">
      <Link href="/academy" className="underline inline-flex min-h-11 items-center py-2">
        {C.academyLink}
      </Link>
      <Link href="/accm" className="text-xs text-muted-foreground underline inline-flex min-h-11 items-center py-2">
        {C.accmLink}
      </Link>
    </div>
  );

  if (state.step === "code") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed" role="status">
          {C.sent}
        </p>
        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm">
            {C.codeLabel}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              required
              className="h-11 rounded-md border px-3 text-base tracking-widest"
            />
          </label>
          {alert}
          <Button type="submit" name="intent" value="verify" className="h-11 w-full" disabled={pending}>
            {C.verify}
          </Button>
        </form>
        <details className="text-sm">
          <summary className="cursor-pointer underline">{C.noCodeToggle}</summary>
          <div className="mt-2 flex flex-col gap-3">
            <p className="leading-relaxed">{C.noCodeBody}</p>
            <form action={action}>
              <Turnstile key={`resend-${state.sentAt ?? 0}`} onState={setCaptcha} />
              <CaptchaError id="captcha-error-resend" show={captchaFailed} />
              <Button
                type="submit"
                name="intent"
                value="resend"
                variant="outline"
                className="h-11 w-full"
                disabled={pending || cooldown > 0 || captchaBlocked}
                aria-describedby={captchaFailed ? "captcha-error-resend" : undefined}
              >
                {C.resend}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground" aria-hidden="true">
              {cooldown > 0 ? C.resendIn(cooldown) : ""}
            </p>
            <form action={action}>
              <button type="submit" name="intent" value="restart" className="text-sm underline">
                {C.otherEmail}
              </button>
            </form>
          </div>
        </details>
        {links}
        {liveRegion}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {liveRegion}
      <p className="text-sm">{C.intro}</p>
      <label className="flex flex-col gap-2 text-sm">
        {C.emailLabel}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="h-11 rounded-md border px-3 text-base"
        />
      </label>
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
      {alert}
      <Turnstile key={`send-${state.sentAt ?? 0}-${state.result}`} onState={setCaptcha} />
      <CaptchaError id="captcha-error-send" show={captchaFailed} />
      <Button
        type="submit"
        name="intent"
        value="send"
        className="h-11 w-full"
        disabled={pending || !consent || captchaBlocked}
        aria-describedby={captchaFailed ? "captcha-error-send" : undefined}
      >
        {C.sendCode}
      </Button>
      {links}
    </form>
  );
}
