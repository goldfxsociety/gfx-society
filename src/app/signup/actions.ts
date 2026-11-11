"use server";

import { createClient } from "@/lib/supabase/server";
import { SIGNUP_CONSENT_VERSION } from "@/config/legal";
import { isCaptchaError, withCaptcha } from "@/lib/auth/captcha";
import { emailConfirmRedirect } from "@/lib/auth/safe-next";
import { signupOutcome, type SignupResult } from "@/lib/auth/signup-outcome";
import { SITE_URL } from "@/lib/site";

export type { SignupResult };

export type SignupInput = {
  displayName: string;
  email: string;
  password: string;
  experienceLevel: string;
  consentRequired: boolean;
  consentMarketing: boolean;
  /** Turnstile token (only sent when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set). */
  captchaToken?: string;
  /** Where to land after the email confirmation link (relative path; sanitized server-side). */
  next?: string;
};

const EXPERIENCE_LEVELS = new Set(["", "never_traded", "demo_only", "trading_live"]);

/**
 * Server-side signup (QA R2). Consent is validated here, on the server,
 * before Supabase is called, and the consent metadata is built here from
 * typed values, so the DB trigger always receives clean booleans and an
 * ISO timestamp. Errors come back as friendly messages, never a generic 500.
 */
export async function signUpWithConsent(input: SignupInput): Promise<SignupResult> {
  if (input?.consentRequired !== true) {
    return { ok: false, error: "Please tick the consent box to create your account." };
  }
  const email = String(input.email ?? "").trim();
  const password = String(input.password ?? "");
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Your password needs at least 6 characters." };
  }
  const experienceLevel = EXPERIENCE_LEVELS.has(input.experienceLevel) ? input.experienceLevel : "";

  // Confirm-email link -> NEXT_PUBLIC_SITE_URL's /auth/callback -> safe relative `next` (QA F1: pinned to the
  // site URL, never the request Origin/Host; no open redirect).
  const emailRedirectTo = emailConfirmRedirect(input.next, SITE_URL);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: withCaptcha({
        data: {
          display_name: String(input.displayName ?? "").slice(0, 100),
          experience_level: experienceLevel,
          consent_version: SIGNUP_CONSENT_VERSION,
          consent_required: true,
          consent_marketing: input.consentMarketing === true,
          consented_at: new Date().toISOString(),
        },
        emailRedirectTo,
      }, input.captchaToken),
    });
    return signupOutcome({ hasSession: Boolean(data?.session), errorMessage: error ? error.message : null }, friendlyAuthError);
  } catch {
    return { ok: false, error: "We couldn't create your account just now. Please try again in a minute." };
  }
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  // Supabase CAPTCHA rejection: same generic message as other temporary failures.
  if (isCaptchaError(message)) return "We couldn't create your account just now. Please try again in a minute.";
  if (m.includes("password")) return message;
  if (m.includes("rate limit")) return "Too many attempts. Please wait a few minutes and try again.";
  if (m.includes("consent")) return message; // from the optional before-user-created hook
  if (m.includes("database error")) {
    return "We couldn't create your account just now. Please try again in a minute.";
  }
  return message;
}
