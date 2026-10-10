import { createClient } from "@/lib/supabase/server";
import { SIGNUP_CONSENT_VERSION } from "@/config/legal";
import { ReconsentBanner } from "./reconsent-banner";

/** True only for a logged-in user with no consent_required row for the current version. Never throws. */
async function needsReconsent(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { count, error } = await supabase
      .from("consent_records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("consent_required", true)
      .eq("consent_version", SIGNUP_CONSENT_VERSION);
    return !error && (count ?? 0) === 0;
  } catch {
    return false;
  }
}

/** Shows the re-consent banner only when needed. Never blocks the page. */
export async function ReconsentGate() {
  return (await needsReconsent()) ? <ReconsentBanner /> : null;
}
