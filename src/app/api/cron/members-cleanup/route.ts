import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Daily Vercel Hobby cron (vercel.json, `30 19 * * *` UTC = 03:30 Asia/Manila). Calls `public.purge_member_gate_logs`, which:
 * - deletes members-gate code-request logs older than 1 day (that purge also runs on every code request), and
 * - purges unconfirmed raw ACCM emails (`private.purge_stale_accm_emails()`: no unexpired link and last submitted more
 *   than 7 days ago; also runs on every submit and token issue). When nobody submits, this cron is what keeps the
 *   "within / up to 8 days" bound in Privacy v1.5. Monitoring: docs/accm-confirm-mailer.md, "Monitoring the purge cron".
 * Protected by CRON_SECRET (Vercel sends "Authorization: Bearer <CRON_SECRET>").
 */
function secretMatches(header: string | null, secret: string): boolean {
  const a = Buffer.from(header ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b); // length guard first (timingSafeEqual throws otherwise)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  const { data, error } = await admin.rpc("purge_member_gate_logs");
  if (error) {
    console.error("[cron/members-cleanup] purge failed", { code: error.code });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: data });
}
