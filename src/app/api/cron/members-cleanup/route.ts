import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Daily Vercel Hobby cron (vercel.json): deletes members-gate code-request logs older than 1 day.
 * Protected by CRON_SECRET (Vercel sends "Authorization: Bearer <CRON_SECRET>").
 * The same purge also runs on every code request, so the 1-day retention holds without the cron.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
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
