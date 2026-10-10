import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isUnknownAcademyPath } from "@/lib/academy/slug-guard";

export async function proxy(request: NextRequest) {
  // Unknown level/lesson slug -> rewrite to an unmatched path so Next.js
  // serves app/not-found.tsx with a real 404 status (before streaming starts).
  if (request.method === "GET" && (await isUnknownAcademyPath(request.nextUrl.pathname))) {
    return NextResponse.rewrite(new URL("/_gfx-not-found", request.url));
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
