/**
 * The ONLY members gate slice 2 uses. When #52's OTP redesign lands, swap these to its helper
 * (e.g. has_members_access()); the DB side is public.is_member().
 */
export { getMembership, requireMember } from "@/lib/members/membership";
export type { Membership } from "@/lib/members/membership";

import { createClient } from "@/lib/supabase/server";

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}
