import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionIsOtp } from "./otp-amr";

/**
 * Real 307 for members-only paths (QA #52 P3-5: the page-level redirect streamed a 200 because of
 * app/loading.tsx). Runs after updateSession, so it reuses the refreshed cookies. The page and the
 * DB (my_membership/RLS) still enforce the same rule; this is only the HTTP-level redirect.
 */
export async function membersRedirect(request: NextRequest, response: NextResponse): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith("/system/members")) return null;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) },
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
  });
  const { data } = await supabase.auth.getClaims();
  let ok = false;
  if (data?.claims && sessionIsOtp(data.claims.amr)) {
    const { data: m, error } = await supabase.rpc("my_membership");
    ok = !error && (m === "active" || m === "grace");
  }
  if (ok) return null;
  const to = NextResponse.redirect(new URL("/system/join", request.url), 307);
  response.cookies.getAll().forEach((c) => to.cookies.set(c));
  return to;
}
