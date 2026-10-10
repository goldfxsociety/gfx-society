import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { StartDiagnosticButton } from "@/components/diagnostic/start-diagnostic-button";

export default async function DiagnosticIntroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl font-bold tracking-tight">The GFX Diagnostic</h1>
        <p className="text-sm text-muted-foreground">
          A short quiz that finds your starting level. It needs a free account so we can
          save your results and point you to the right lesson.
        </p>
        <p className="text-sm text-muted-foreground">
          Brand new to trading? You don&apos;t need it — start with Lesson 1, no signup needed.
        </p>
        <Link href="/start" className={buttonVariants({ variant: "default" })}>
          Start here (no signup)
        </Link>
        <p className="text-xs text-muted-foreground">Already have an account? Log in to save your results.</p>
        <div className="flex gap-3">
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Log in
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: "outline" })}>
            Sign up
          </Link>
        </div>
        <Link href="/academy" className="text-sm text-muted-foreground underline">
          Or go straight to the Academy
        </Link>
      </div>
    );
  }

  const { data: previousSession } = await supabase
    .from("diagnostic_sessions")
    .select("id")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          GFX Diagnostic
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Let&apos;s find your starting point</h1>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 text-sm">
        <p>No trading experience needed.</p>
        <p>This isn&apos;t a pass-or-fail test — there&apos;s no way to fail it.</p>
        <p>There&apos;s no penalty for not knowing something.</p>
        <p>It just helps us figure out where to start you.</p>
        <p>The Academy is fully open either way.</p>
      </div>

      <StartDiagnosticButton previousSessionId={previousSession?.id ?? undefined} />

      <Link href="/academy" className="text-sm text-muted-foreground underline">
        Skip — go straight to the Academy
      </Link>
    </div>
  );
}
