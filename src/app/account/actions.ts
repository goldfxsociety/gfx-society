"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type DeleteState = { error: string | null };

/**
 * Self-service account deletion. Requires the user to type DELETE, then calls
 * the SECURITY DEFINER RPC public.delete_my_account(), which deletes only the
 * caller's own data and auth user (no service-role key in the app).
 */
export async function deleteMyAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "DELETE") {
    return { error: "I-type ang DELETE (all caps) para i-confirm." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Naka-log out ka na. Log in ulit para i-delete ang account mo." };

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("[account/delete] rpc failed", { code: error.code });
    return {
      error:
        "Hindi na-delete ang account mo. Try ulit, o mag-email sa goldfx.society@gmail.com (subject: Data Deletion Request).",
    };
  }
  // Clear the session cookies locally (the auth user no longer exists).
  await supabase.auth.signOut().catch(() => {});
  redirect("/?deleted=1");
}
