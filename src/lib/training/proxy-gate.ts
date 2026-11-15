import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Membership } from "@/lib/members/membership";
import { MEMBERS_HOME, joinPath } from "@/lib/members/routes";
import { courseRouteAccess, isExplorerCourse, trainingRouteAccess } from "@/lib/members/tier";

/**
 * HTTP-level gate for slice 2 (QA #55 P3): real 307s for members-only paths and a real 404 for
 * /admin/payments, decided before any streaming (app/loading.tsx makes page-level redirects a 200).
 * Sprint 3: /training and Gold Reset lessons/capstone are also open to Explorers (rules: src/lib/members/tier.ts).
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
  const membership: Membership = !error && (ms === "active" || ms === "grace") ? ms : "none";
  const member = membership !== "none";
  if (legacyHome) return go(member ? MEMBERS_HOME : joinPath(null));
  if (member) return null;

  // Sprint 3 (explorer-linked-tiers-spec §2.1): /training is the home for confirmed Explorers too.
  if (path !== "/training" && path !== "/training/") {
    const m = path.match(/^\/courses\/([^/]+)\/([^/]+)\/?$/);
    const slug = m ? decodeURIComponent(m[1]) : "";
    const sub = m ? decodeURIComponent(m[2]) : "";
    // Gold Reset lessons + capstone: free for a consented Explorer (§6.2). Consent comes from my_join_state (own row).
    if (isExplorerCourse(slug) && sub !== "pay" && sub !== "placement") {
      const { data: js, error: jsErr } = await supabase.rpc("my_join_state");
      const consented = !jsErr && (js as { consent?: unknown } | null)?.consent === true;
      if (courseRouteAccess({ loggedIn, membership, consented }, slug, sub) === "allow") return null;
    }
    // S8 = A: a removed member keeps lessons + capstone of a bought course (not /pay or /placement).
    if (m && sub !== "pay" && sub !== "placement") {
      const { data: info } = await supabase.rpc("my_payment_info", { p_course_slug: slug });
      if ((info as { state?: string } | null)?.state === "approved") return null;
    }
    // Journey 1 (spec §4.1): keep the deep link through /system/join so verify / consent lands back here.
    return go(joinPath(path));
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const confirmed = Boolean(user?.email && user.email_confirmed_at);
  return trainingRouteAccess({ loggedIn, confirmed, membership }) === "allow" ? null : go(joinPath(null));
}
