"use server";

import { createClient } from "@/lib/supabase/server";

export type JoinResult = "idle" | "matched" | "no_match" | "rate_limited" | "unverified_email" | "consent_required" | "error";
export type JoinState = { result: JoinResult };

/**
 * Calls public.claim_membership(consent). The RPC matches ONLY the caller's own
 * confirmed auth email against the hashed allowlist; no email is sent from here.
 */
export async function claimMembership(_prev: JoinState, formData: FormData): Promise<JoinState> {
  if (formData.get("consent") !== "on") return { result: "consent_required" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { result: "error" };
  const { data, error } = await supabase.rpc("claim_membership", { p_consent: true });
  if (error) {
    console.error("[system/join] claim_membership failed", { code: error.code });
    return { result: "error" };
  }
  const ok: JoinResult[] = ["matched", "no_match", "rate_limited", "unverified_email"];
  return { result: ok.includes(data as JoinResult) ? (data as JoinResult) : "error" };
}
