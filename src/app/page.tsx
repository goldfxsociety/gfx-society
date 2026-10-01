import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let supabaseStatus: "connected" | "error" = "connected";
  let errorMessage = "";

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getUser();
    // "Auth session missing" just means no one is logged in yet — that's
    // expected and still proves the connection to Supabase works.
    if (error && error.name !== "AuthSessionMissingError") {
      supabaseStatus = "error";
      errorMessage = error.message;
    }
  } catch (err) {
    supabaseStatus = "error";
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          GFX Society
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          v2 scaffold is live
        </h1>
        <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          This is the starting point for GFX Society — Academy, Dashboard,
          Resources, Community, Broker, and Admin will all be built here.
        </p>
      </div>

      <div
        className={`rounded-full border px-4 py-1.5 text-xs font-medium ${
          supabaseStatus === "connected"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        }`}
      >
        {supabaseStatus === "connected"
          ? "Supabase: connected"
          : `Supabase: error — ${errorMessage}`}
      </div>
    </div>
  );
}
