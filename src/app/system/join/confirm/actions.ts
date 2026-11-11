"use server";

import { confirmAccmEmail, type ConfirmResult } from "@/lib/members/access-request";
import { createClient } from "@/lib/supabase/server";

export type ConfirmState = { result: "idle" | ConfirmResult };

/**
 * POST-only confirm (QA N1): runs from the page's button, never on the GET render. Uses the user's own session
 * (anon key + cookies); public.confirm_accm_email checks that the token's request belongs to auth.uid(). The token is
 * never logged or echoed back; the answer is one neutral 'invalid' for every failure.
 */
export async function confirmAccm(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const r = await confirmAccmEmail(
    {
      loggedIn: async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return Boolean(user);
      },
      confirm: async (t) => {
        const { data, error } = await supabase.rpc("confirm_accm_email", { p_token: t });
        if (error) {
          console.error("[system/join/confirm] confirm_accm_email failed", { code: error.code });
          return null;
        }
        return typeof data === "string" ? data : null;
      },
    },
    token,
  );
  return { result: r };
}
