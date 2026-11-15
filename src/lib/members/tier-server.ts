import { getMembership, type Membership } from "@/lib/members/membership";
import { tierFrom, type Tier } from "@/lib/members/tier";
import { createClient } from "@/lib/supabase/server";

export type TierInfo = {
  tier: Tier;
  membership: Membership;
  loggedIn: boolean;
  confirmed: boolean;
  /** join-v2 consent on file (public.my_join_state; no email, no hash). */
  consented: boolean;
  /** An active access request (pending / awaiting_email_confirm). */
  pending: boolean;
};

/**
 * The caller's tier from existing RPCs only (spec A5): my_membership + my_join_state. Own data only.
 * Pass `known` when the page already called getMembership() to skip a second my_membership call.
 */
export async function getTier(known?: { loggedIn: boolean; membership: Membership }): Promise<TierInfo> {
  const { loggedIn, membership } = known ?? (await getMembership());
  if (!loggedIn) return { tier: "guest", membership, loggedIn, confirmed: false, consented: false, pending: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const confirmed = Boolean(user?.email && user.email_confirmed_at);
  const tier = tierFrom({ loggedIn, confirmed, membership });
  if (tier !== "explorer") return { tier, membership, loggedIn, confirmed, consented: tier === "linked", pending: false };
  const { data, error } = await supabase.rpc("my_join_state");
  const s = (error ? null : data) as { consent?: unknown; request?: { status?: string } | null } | null;
  const status = s?.request?.status;
  return {
    tier,
    membership,
    loggedIn,
    confirmed,
    consented: s?.consent === true,
    pending: status === "pending" || status === "awaiting_email_confirm",
  };
}
