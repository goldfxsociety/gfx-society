import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/pending-summary  (Authorization: Bearer <token>)
 * Counts only, for Jarvis' poll. The token is checked in the DB against sha256 stored in
 * private.app_settings ('payments_summary_token_sha256', set by Ben). DB also rate-limits (60/h).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const headers = { "Cache-Control": "no-store" };
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ error: "unavailable" }, { status: 503, headers });
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("pending_payments_summary", { p_token: token });
  if (error || !data) return Response.json({ error: "unavailable" }, { status: 503, headers });
  const d = data as { error?: string; pending_count?: number; oldest_pending_at?: string | null };
  if (d.error === "rate_limited") return Response.json({ error: "rate_limited" }, { status: 429, headers });
  if (d.error) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  return Response.json({ pending_count: d.pending_count ?? 0, oldest_pending_at: d.oldest_pending_at ?? null }, { headers });
}
