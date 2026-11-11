import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callbackRedirect } from "@/lib/auth/safe-next";

// Email confirmation / email link landing. Logic (same-origin, safe `next`) lives in callbackRedirect
// so it is unit-tested offline (scripts/test-signup-confirm.mjs).
export async function GET(request: Request) {
  const to = await callbackRedirect(request.url, async (code) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  });
  return NextResponse.redirect(to);
}
