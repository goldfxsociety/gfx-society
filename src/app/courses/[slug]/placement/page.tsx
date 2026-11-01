import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findCatalog } from "@/lib/training/courses";
import { requireMember } from "@/lib/training/gate";
import { formatPht } from "@/lib/training/time";
import { ContentDisclaimerFooter } from "@/components/training/content-disclaimer-footer";
import { PlacementForm } from "./placement-form";

export const metadata: Metadata = { title: "Placement quiz | GFX", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** B9 / D2: 10 questions, pass >= 80%, unlimited retries with 24h cooldown. Only courses with a prereq. */
export default async function PlacementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = findCatalog(slug);
  if (!catalog?.prereqSlug) notFound();
  await requireMember(`/courses/${slug}/placement`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_placement_quiz", { p_course_slug: slug });
  const quiz = data as { disclaimer?: string | null; passed: boolean; next_attempt_at: string | null; questions: { q: string; options: string[] }[] | null } | null;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 pt-8 pb-24">
      <Link href={`/courses/${slug}`} className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
        ← {catalog.title}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Placement quiz</h1>
      <p className="text-sm">
        10 tanong mula sa Gold Strategy Basics. Kailangan ng 80% para ma-unlock ang {catalog.title}. Puwedeng ulitin pagkatapos ng 24 hours.
      </p>
      {!quiz || !quiz.questions ? (
        <p className="text-sm text-muted-foreground">Inihahanda pa ang placement quiz. Balikan mo ito mamaya.</p>
      ) : quiz.passed ? (
        <p className="text-sm">Pasado ka na sa placement quiz ✓</p>
      ) : quiz.next_attempt_at ? (
        <p className="text-sm">Puwede kang sumubok ulit pagkatapos ng {formatPht(quiz.next_attempt_at)}.</p>
      ) : (
        <PlacementForm slug={slug} questions={quiz.questions} />
      )}
      <ContentDisclaimerFooter disclaimer={quiz?.disclaimer} />
    </div>
  );
}
