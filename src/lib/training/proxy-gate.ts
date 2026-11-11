import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MEMBERS_HOME, joinPath } from "@/lib/members/routes";

/**
 * HTTP-level gate for slice 2 (QA #55 P3): real 307s for members-only paths and a real 404 for
 * /admin/payments, decided before any streaming (app/loading.tsx makes page-level redirects a 200).
 * Pages and the DB (RLS, my_membership, is_admin) still enforce the same rules.
 */
const MEMBERS_ONLY = [/^\/training\/?$/, /^\/courses\/[^/]+\/[^/]+\/?$/];

export async function trainingGate(request: NextRequest, response: NextResponse): Promise<NextResponse | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null; // HEAD = GET (QA #57 P3)
  const path = request.nextUrl.pathname;
  const legacyHome = path === "/system/members" || path === "/system/members/";
  const admin = path === "/admin/payments" || path.startsWith("/admin/payments/");
  const members = MEMBERS_ONLY.some((r) => r.test(path));
  if (!legacyHome && !admin && !members) return null;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) },
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
  });
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims?.sub);

  const go = (to: string, status: 307 | 404 = 307) => {
    const res = status === 404 ? NextResponse.rewrite(new URL("/_gfx-not-found", request.url)) : NextResponse.redirect(new URL(to, request.url), 307);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (admin) {
    if (!loggedIn) return go("", 404);
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    return !error && isAdmin === true ? null : go("", 404);
  }
  if (!loggedIn) return go(`/login?next=${encodeURIComponent(legacyHome ? MEMBERS_HOME : path)}`);
  // Any logged-in session (Academy password /login included); the DB decides membership.
  const { data: ms, error } = await supabase.rpc("my_membership");
  const member = !error && (ms === "active" || ms === "grace");
  if (!member && !legacyHome) {
    // S8 = A: a removed member keeps lessons + capstone of a bought course (not /pay or /placement).
    const m = path.match(/^\/courses\/([^/]+)\/([^/]+)\/?$/);
    if (m && m[2] !== "pay" && m[2] !== "placement") {
      const { data: info } = await supabase.rpc("my_payment_info", { p_course_slug: decodeURIComponent(m[1]) });
      if ((info as { state?: string } | null)?.state === "approved") return null;
    }
  }
  // Journey 1 (spec §4.1): keep the deep link through /system/join so verify lands back here.
  if (!member) return go(joinPath(legacyHome ? null : path));
  return legacyHome ? go(MEMBERS_HOME) : null;
}
