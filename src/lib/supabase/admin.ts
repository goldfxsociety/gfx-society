import { createClient } from "@supabase/supabase-js";
import { createAdminRestFetch } from "./admin-fetch";

/**
 * Server-only service-role client. Used ONLY for public.purge_member_gate_logs (cron) and, when
 * ACCM_CONFIRM_MAIL_LIVE is on, public.issue_accm_confirm_token (src/lib/members/accm-confirm-send.ts). Never import
 * from a client component.
 * Returns null when SUPABASE_SERVICE_ROLE_KEY isn't configured.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") throw new Error("admin client is server-only");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createAdminRestFetch(url, key) },
  });
}
