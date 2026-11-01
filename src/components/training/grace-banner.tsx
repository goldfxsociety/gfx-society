import { createClient } from "@/lib/supabase/server";
import { BOUGHT_STAY_OPEN_NOTE, CONTACT_EMAIL } from "@/config/training";
import { formatPhtDate } from "@/lib/training/time";

/** Shown on /courses and /account while membership is in grace (Design F4). */
export async function GraceBanner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // RLS: a user can read only their own member_status row.
  const { data } = await supabase.from("member_status").select("grace_until").eq("user_id", user.id).maybeSingle();
  const until = formatPhtDate(data?.grace_until);
  return (
    <p role="status" className="rounded-lg border border-amber-500/60 p-3 text-sm">
      Hindi na namin ma-verify ang membership mo. May access ka pa {until ? `hanggang ${until}` : "sa ngayon"}. Kung mali ito, email{" "}
      {CONTACT_EMAIL}. {BOUGHT_STAY_OPEN_NOTE}
    </p>
  );
}
