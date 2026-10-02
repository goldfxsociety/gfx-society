import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    profileName = profile?.display_name ?? null;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          GFX Society
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {user ? `Welcome back${profileName ? `, ${profileName}` : ""}` : "v2 scaffold is live"}
        </h1>
        <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          {user
            ? `Logged in as ${user.email}. Your profile row was created automatically on signup.`
            : "This is the starting point for GFX Society — Academy, Dashboard, Resources, Community, Broker, and Admin will all be built here."}
        </p>
      </div>

      <div className="flex gap-3">
        <Link href="/academy" className={buttonVariants({ variant: "default" })}>
          Go to Academy
        </Link>
        {user ? (
          <>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Dashboard
            </Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/signup" className={buttonVariants({ variant: "outline" })}>
              Sign up
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              Log in
            </Link>
          </>
        )}
      </div>

      <div className="flex gap-4 text-xs text-zinc-500">
        <Link href="/resources" className="underline hover:text-amber-600">
          Resources
        </Link>
        <Link href="/community" className="underline hover:text-amber-600">
          Community
        </Link>
        <Link href="/broker" className="underline hover:text-amber-600">
          Broker
        </Link>
      </div>
    </div>
  );
}
