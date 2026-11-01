import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isUnknownAcademyPath } from "@/lib/academy/slug-guard";
import { membersRedirect } from "@/lib/members/proxy-gate";
import { trainingGate } from "@/lib/training/proxy-gate";
import { CATALOG } from "@/config/training";

export async function proxy(request: NextRequest) {
  // Unknown level/lesson slug -> rewrite to an unmatched path so Next.js
  // serves app/not-found.tsx with a real 404 status (before streaming starts).
  if (request.method === "GET" && (await isUnknownAcademyPath(request.nextUrl.pathname))) {
    return NextResponse.rewrite(new URL("/_gfx-not-found", request.url));
  }
  // Same for /courses/<unknown>[/...]: real 404 instead of a streamed soft 404.
  const course = /^\/courses\/([^/]+)/.exec(request.nextUrl.pathname)?.[1];
  if (request.method === "GET" && course && !CATALOG.some((c) => c.slug === course)) {
    return NextResponse.rewrite(new URL("/_gfx-not-found", request.url));
  }
  const response = await updateSession(request);
  return (await trainingGate(request, response)) ?? (await membersRedirect(request, response)) ?? response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
