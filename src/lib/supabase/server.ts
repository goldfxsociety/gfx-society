import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // supabase-js uses the global fetch, which Next.js patches with its
      // own Data Cache inside Server Components — without this, a Supabase
      // REST response (including an error response) can get cached and
      // served to every subsequent request regardless of user/session,
      // and on Vercel that cache can persist across deployments.
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore because
            // middleware (see supabase/middleware.ts) refreshes the session.
          }
        },
      },
    },
  );
}
