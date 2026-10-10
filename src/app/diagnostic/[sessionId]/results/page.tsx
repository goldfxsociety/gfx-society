import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { effectiveTier, MIN_ANSWERS_FOR_TIER } from "@/lib/diagnostic/scoring";

const TIER_LABEL: Record<string, string> = {
  "No Data": "Not tested yet",
  "Not Enough Data": "Not enough data",
  Developing: "Developing",
  Familiar: "Familiar",
  "Strong Foundation": "Strong Foundation",
};

const COMPETENCY_LABEL: Record<string, string> = {
  foundations: "Foundations",
  platform: "Platform & MT5",
  price_action: "Candlesticks & Price Action",
  market_structure: "Market Structure",
  technical_tools: "Technical Tools",
  gold: "Gold / XAUUSD",
  setups: "Trading Setups",
  risk_management: "Risk Management",
  psychology: "Trading Psychology",
  journaling: "Journaling",
};

export default async function DiagnosticResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: session } = await supabase
    .from("diagnostic_sessions")
    .select("id, status, competency_scores, recommended_lesson_id")
    .eq("id", sessionId)
    .single();

  if (!session || session.status !== "completed") notFound();

  const scores = (session.competency_scores ?? {}) as Record<
    string,
    { answered: number; correct: number; tier: string; confidence: string }
  >;

  let recommendedLesson: { slug: string; title: string; levelSlug: string } | null = null;
  if (session.recommended_lesson_id) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("slug, title, levels(slug)")
      .eq("id", session.recommended_lesson_id)
      .single();
    const level = Array.isArray(lesson?.levels) ? lesson.levels[0] : lesson?.levels;
    if (lesson && level) {
      recommendedLesson = {
        slug: lesson.slug,
        title: lesson.title,
        levelSlug: (level as { slug: string }).slug,
      };
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Diagnostic Complete
        </span>
        <h1 className="text-2xl font-bold tracking-tight">You&apos;re all set.</h1>
        <p className="text-sm text-muted-foreground">
          Based on what you already know, we&apos;ve prepared a learning path just for you.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/10 p-5">
        {recommendedLesson ? (
          <>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Your next step
            </span>
            <p className="text-sm font-semibold">{recommendedLesson.title}</p>
            <p className="text-xs text-muted-foreground">
              Nothing is locked — explore any lesson anytime.
            </p>
            <Link
              href="/learning"
              className={cn(buttonVariants({ variant: "default" }), "mt-1 self-start")}
            >
              Go to My Learning Path
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">You&apos;ve completed the Academy 🎓</p>
            <p className="text-xs text-muted-foreground">
              The results below can still point you toward lessons worth revisiting, whenever you&apos;d like.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-muted-foreground">Review My Results</p>
        <p className="text-xs text-muted-foreground">
          This is a starting point, not a grade — and the Academy stays fully open either way.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.entries(scores).map(([key, score]) => (
            <div key={key} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">{COMPETENCY_LABEL[key] ?? key}</p>
              <p className="text-sm text-primary">{TIER_LABEL[effectiveTier(score)] ?? effectiveTier(score)}</p>
              {score.answered > 0 && score.answered < MIN_ANSWERS_FOR_TIER && (
                <p className="text-xs text-muted-foreground">
                  Needs at least {MIN_ANSWERS_FOR_TIER} answers — based on {score.answered} question{score.answered === 1 ? "" : "s"}
                </p>
              )}
            </div>
          ))}
          {Object.keys(scores).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No questions were answered this round — you can always retake the diagnostic.
            </p>
          )}
        </div>
      </div>

      <Link href="/academy" className="text-sm text-muted-foreground underline">
        Go to the Academy
      </Link>
    </div>
  );
}
