"use server";

import { redirect } from "next/navigation";
import { MEMBERS_CONSENT_VERSION } from "@/content/members-gate";
import { submitConsent, type ConsentDeps, type ConsentResult } from "@/lib/members/consent-flow";
import { JOIN_LOGIN_PATH, MEMBERS_HOME } from "@/lib/members/routes";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { result: "idle" | Exclude<ConsentResult, "active" | "login_required"> };

async function deps(): Promise<ConsentDeps> {
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
  };
}

export async function joinConsent(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const r = await submitConsent(await deps(), formData.get("consent") === "on");
  if (r === "active") redirect(MEMBERS_HOME);
  if (r === "login_required") redirect(JOIN_LOGIN_PATH);
  return { result: r };
}
