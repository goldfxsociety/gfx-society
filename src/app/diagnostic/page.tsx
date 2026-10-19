import { cn } from "cn";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { StartDiagnosticButton } from "@/components/diagnostic/start-diagnostic-button";

export const metadata: Metadata = {
  title: "Skills Diagnostic",
  description: "Find your starting point: a short gold trading skills check that recommends your first lessons.",
  alternates: { canonical: "/diagnostic" },
  openGraph: { title: "Skills Diagnostic", description: "Find your starting point: a short gold trading skills check that recommends your first lessons.", url: "/diagnostic", images: ["/opengraph-image"] },
};


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
          Short quiz ito para malaman ang starting level mo. Kailangan ng free account para ma-save ang results mo at ma-recommend namin ang tamang lesson.
        </p>
        <p className="text-sm text-muted-foreground">
          Bago ka pa lang sa trading? Hindi mo ito kailangan. Start ka sa Lesson 1, no signup needed.
        </p>
        <Link href="/start" className={cn(buttonVariants({ variant: "default" }), "h-12 w-full text-base")}>
          Start here (no signup)
        </Link>
        <p className="text-sm text-muted-foreground">May account ka na? Log in para ma-save ang results mo.</p>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
            Log in
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
            Sign up
          </Link>
        </div>
        <Link href="/academy" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
          Or go straight to the Academy
        </Link>
      </div>
    );
  }

  const { data: previousSession } = await supabase
    .from("diagnostic_sessions")
    .select("id, status")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: questionCount } = await supabase
    .from("diagnostic_questions")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);
  const inProgress = !!previousSession && previousSession.status !== "completed";
  let answeredCount = 0;
  if (inProgress) {
    const { count } = await supabase
      .from("diagnostic_answers")
      .select("id", { count: "exact", head: true })
      .eq("session_id", previousSession!.id);
    answeredCount = count ?? 0;
  }

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
        <p className="text-muted-foreground">
          ⏱ {questionCount ?? 30} questions · ~{Math.max(1, Math.round((questionCount ?? 30) * 0.27))}–
          {Math.max(2, Math.ceil((questionCount ?? 30) / 3))} min. Naka-save ang bawat sagot, kaya pwede kang
          tumigil at ituloy later.
        </p>
      </div>

      {inProgress && (
        <Link
          href={`/diagnostic/${previousSession!.id}`}
          className={cn(buttonVariants({ variant: "default" }), "h-12 w-full text-base")}
        >
          Ituloy ang Diagnostic ({answeredCount} of {questionCount ?? 30} done) →
        </Link>
      )}

      <StartDiagnosticButton
        previousSessionId={previousSession?.id ?? undefined}
        secondary={inProgress}
      />

      <Link href="/academy" className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
        Skip — go straight to the Academy
      </Link>
    </div>
  );
}
