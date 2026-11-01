"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MEMBERS_CONSENT_VERSION } from "@/content/members-gate";
import { replyFloorMs, requestCode, verifyCode, type OtpDeps, type SendResult, type VerifyResult } from "@/lib/members/otp-flow";
import { MEMBERS_HOME } from "@/lib/members/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { step: "email" | "code"; email: string; result: "idle" | SendResult | VerifyResult; sentAt?: number };

async function deps(): Promise<OtpDeps> {
  const supabase = await createClient();
  return {
    codeAllowed: async (email, ip) => {
      const admin = createAdminClient();
      if (!admin) {
        console.error("[system/join] send gate not configured");
        return null;
      }
      const { data, error } = await admin.rpc("member_code_allowed", { p_email: email, p_ip: ip });
      if (error) {
        console.error("[system/join] member_code_allowed failed", { code: error.code });
        return null;
      }
      return data === true;
    },
    captchaRequired: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    sendOtp: async (email, captchaToken) => {
      // Only reached for allowlisted emails; runs in after(), outside the response path. Uses a
      // cookie-less anon client (6-digit code needs no PKCE verifier cookie). Creates the auth user
      // if needed (passwordless).
      const anon = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
      });
      const { error } = await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: true, ...(captchaToken ? { captchaToken } : {}) },
      });
      if (error) console.error("[system/join] send code failed", { status: error.status });
      return !error;
    },
    verifyOtp: async (email, token) => {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (!error) return "ok";
      return error.code === "otp_expired" || /expired/i.test(error.message) ? "expired" : "wrong";
    },
    recordConsent: async () => {
      const { data, error } = await supabase.rpc("record_member_consent", { p_version: MEMBERS_CONSENT_VERSION });
      if (error) {
        console.error("[system/join] record_member_consent failed", { code: error.code });
        return null;
      }
      return typeof data === "string" ? data : null;
    },
    defer: (work) =>
      after(async () => {
        try {
          await work();
        } catch {
          console.error("[system/join] deferred send failed");
        }
      }),
    minReplyMs: replyFloorMs,
  };
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export async function joinStep(prev: JoinState, formData: FormData): Promise<JoinState> {
  const intent = formData.get("intent");
  if (intent === "send" || intent === "resend") {
    const email = String(formData.get("email") ?? prev.email);
    const consent = intent === "resend" ? prev.step === "code" : formData.get("consent") === "on";
    const token = String(formData.get("cf-turnstile-response") ?? "");
    const r = await requestCode(await deps(), email, consent, await clientIp(), token);
    return { step: r === "sent" ? "code" : "email", email, result: r, sentAt: r === "sent" ? Date.now() : prev.sentAt };
  }
  if (intent === "verify" && prev.step === "code") {
    const r = await verifyCode(await deps(), prev.email, String(formData.get("code") ?? ""));
    if (r === "active") redirect(MEMBERS_HOME);
    return { step: "code", email: prev.email, result: r, sentAt: prev.sentAt };
  }
  if (intent === "restart") return { step: "email", email: "", result: "idle" };
  return { ...prev, result: "error" };
}
