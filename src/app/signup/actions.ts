"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SIGNUP_CONSENT_VERSION } from "@/config/legal";

export type SignupInput = {
  displayName: string;
  email: string;
  password: string;
  experienceLevel: string;
  consentRequired: boolean;
  consentMarketing: boolean;
};

export type SignupResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; error: string };

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

  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("host") ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}` : "");

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: String(input.displayName ?? "").slice(0, 100),
          experience_level: experienceLevel,
          consent_version: SIGNUP_CONSENT_VERSION,
          consent_required: true,
          consent_marketing: input.consentMarketing === true,
          consented_at: new Date().toISOString(),
        },
        ...(origin ? { emailRedirectTo: `${origin}/auth/callback` } : {}),
      },
    });
    if (error) {
      return { ok: false, error: friendlyAuthError(error.message) };
    }
    return { ok: true, needsEmailConfirmation: !data.session };
  } catch {
    return { ok: false, error: "We couldn't create your account just now. Please try again in a minute." };
  }
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (m.includes("password")) return message;
  if (m.includes("rate limit")) return "Too many attempts. Please wait a few minutes and try again.";
  if (m.includes("consent")) return message; // from the optional before-user-created hook
  if (m.includes("database error")) {
    return "We couldn't create your account just now. Please try again in a minute.";
  }
  return message;
}
