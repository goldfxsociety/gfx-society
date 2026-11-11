"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { REQUEST_CONSENT_VERSION } from "@/content/access-request";
import { MEMBERS_CONSENT_VERSION } from "@/content/members-gate";
import { submitRequest, type RequestDeps, type RequestResult } from "@/lib/members/access-request";
import { submitConsent, type ConsentDeps, type ConsentResult } from "@/lib/members/consent-flow";
import { joinLoginPath, memberNext } from "@/lib/members/routes";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { result: "idle" | Exclude<ConsentResult, "active" | "login_required"> };
export type RequestState = { result: "idle" | Exclude<RequestResult, "matched" | "login_required" | "already_member"> };

async function consentDeps(): Promise<ConsentDeps & { consentRecorded: () => Promise<boolean> }> {
  // The user's own session (anon key + cookies). No service-role/admin client on the member path.
  const supabase = await createClient();
  return {
    loggedIn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return Boolean(user);
    },
    recordConsent: async () => {
      const { data, error } = await supabase.rpc("record_member_consent", { p_version: MEMBERS_CONSENT_VERSION });
      if (error) {
        console.error("[system/join] record_member_consent failed", { code: error.code });
        return null;
      }
      return typeof data === "string" ? data : null;
    },
    // Spec §4.2: a join-v2 consent already on file counts; the user is not asked to tick again.
    consentRecorded: async () => {
      const { data, error } = await supabase.rpc("my_join_state");
      return !error && (data as { consent?: unknown } | null)?.consent === true;
    },
  };
}

export async function joinConsent(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const next = String(formData.get("next") ?? "");
  const d = await consentDeps();
  const ticked = formData.get("consent") === "on" || (await d.consentRecorded());
  const r = await submitConsent(d, ticked);
  if (r === "active") redirect(memberNext(next));
  if (r === "login_required") redirect(joinLoginPath(next));
  return { result: r };
}

/** Client IP as the platform reports it (first x-forwarded-for hop). Only passed to the RPC, which hashes it. */
async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64);
}

export async function submitAccessRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const next = String(formData.get("next") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const deps: RequestDeps = {
    loggedIn: async () => Boolean(user),
    submit: async (accmEmail, ibName) => {
      const { data, error } = await supabase.rpc("submit_access_request", {
        p_accm_email: accmEmail,
        p_ib_name: ibName,
        p_consent_version: REQUEST_CONSENT_VERSION,
        p_ip: await clientIp(),
      });
      if (error) {
        console.error("[system/join] submit_access_request failed", { code: error.code });
        return null;
      }
      return typeof data === "string" ? data : null;
    },
    // No sendConfirm: ACCM_CONFIRM_MAIL_LIVE is false (no mailer in this build).
  };
  const r = await submitRequest(
    deps,
    {
      accmEmail: String(formData.get("accm_email") ?? ""),
      ibName: String(formData.get("ib_name") ?? ""),
      consent: formData.get("request_consent") === "on",
    },
    user?.email ?? null,
  );
  if (r === "matched" || r === "already_member") redirect(memberNext(next));
  if (r === "login_required") redirect(joinLoginPath(next));
  return { result: r };
}
