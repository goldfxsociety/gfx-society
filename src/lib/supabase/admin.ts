import { createClient } from "@supabase/supabase-js";

/**
 * Server-only service-role client. Used ONLY for public.member_code_reserve / member_code_finish (send gate) and
 * public.purge_member_gate_logs (cron). Never import from a client component.
 * Returns null when SUPABASE_SERVICE_ROLE_KEY isn't configured.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") throw new Error("admin client is server-only");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) },
  });
}
