import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Membership = "active" | "grace" | "none";

/**
 * Effective membership of the logged-in user, from the SECURITY DEFINER RPC
 * public.my_membership() (own row only). Never reads the allowlist itself.
 * Returns "none" if logged out or if the RPC is missing (schema not applied).
 */
export async function getMembership(): Promise<{ loggedIn: boolean; membership: Membership }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { loggedIn: false, membership: "none" };
  const { data, error } = await supabase.rpc("my_membership");
  if (error) {
    console.error("[members] my_membership failed", { code: error.code });
    return { loggedIn: true, membership: "none" };
  }
  const m = data === "active" || data === "grace" ? data : "none";
  return { loggedIn: true, membership: m };
}

/** Server-side gate for members-only pages. */
export async function requireMember(path: string): Promise<Exclude<Membership, "none">> {
  const { loggedIn, membership } = await getMembership();
  if (!loggedIn) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (membership === "none") redirect("/system/join");
  return membership;
}
