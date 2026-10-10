"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReconsentResult = { ok: true } | { ok: false; error: string };

/**
 * Records re-consent for the logged-in user via the SECURITY DEFINER RPC
 * public.record_reconsent. The user id, email hash and consent version are
 * derived in the database; only the optional marketing flag comes from here.
 */
export async function acceptReconsent(input: {
  agree: boolean;
  marketing: boolean;
}): Promise<ReconsentResult> {
  if (input?.agree !== true) {
    return { ok: false, error: "Please tick “I agree” to continue." };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Please log in again." };
    const { error } = await supabase.rpc("record_reconsent", {
      p_marketing: input.marketing === true,
    });
    if (error) return { ok: false, error: "We couldn't save that just now. Please try again." };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't save that just now. Please try again." };
  }
}
