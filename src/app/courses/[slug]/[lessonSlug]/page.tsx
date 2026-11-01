import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/server";
import { findCatalog, getCourseView } from "@/lib/training/courses";
import { getMembership } from "@/lib/training/gate";
import { Chip } from "@/components/training/chip";
import { MembersFooter } from "@/components/training/members-footer";
import { LessonInteractive } from "./lesson-interactive";

/** Plain-text paragraphs: split on blank lines; drop heading #, bold/italic markers, list bullets. */
function toParagraphs(md: string): string[] {
  return md
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) =>
          line
            .replace(/^\s{0,3}#{1,6}\s+/, "")
            .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
            .replace(/^\s*>\s?/, "")
            .replace(/(\*\*|__)(.+?)\1/g, "$2")
            .replace(/(^|[^*\w])[*_]([^*_\n]+)[*_](?=[^*\w]|$)/g, "$1$2")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .trim(),
        )
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean);
}

export const metadata: Metadata = { title: "Lesson | GFX Trading System", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonSlug: string }> }) {
  const { slug, lessonSlug } = await params;
  const catalog = findCatalog(slug);
  if (!catalog) notFound();
  const { loggedIn, membership } = await getMembership();
  if (!loggedIn) redirect(`/login?next=/courses/${slug}/${lessonSlug}`);
  if (membership === "none") redirect("/system/join");

  const v = await getCourseView(catalog, membership);
  const idx = v.lessons.findIndex((l) => l.slug === lessonSlug);
  // Not owned / draft / locked: RLS returns nothing, so no body ever reaches the client.
  if (idx < 0) redirect(`/courses/${slug}#modules`);
  const meta = v.lessons[idx];

  const supabase = await createClient();
  const [{ data: lesson }, { data: quiz }, { data: prog }] = await Promise.all([
    supabase.from("training_lessons").select("id, title, tldr, body_md, takeaway, practice_task").eq("id", meta.id).single(),
    supabase.rpc("get_lesson_quiz", { p_lesson_id: meta.id }),
    supabase.from("training_progress").select("practice_done, completed_at").eq("lesson_id", meta.id).maybeSingle(),
  ]);
  if (!lesson) redirect(`/courses/${slug}#modules`);

  const inModule = v.lessons.filter((l) => l.moduleTitle === meta.moduleTitle);
  const posInModule = inModule.findIndex((l) => l.id === meta.id) + 1;
  const modulePct = Math.round((inModule.filter((l) => l.completed).length / inModule.length) * 100);
  const next = v.lessons[idx + 1];
  const nextIsNewModule = next && next.moduleTitle !== meta.moduleTitle;
  // 80% lock applies to modules only: next module needs this module's lessons completed.
  const moduleDone = inModule.every((l) => l.completed);
  const gold = cn(buttonVariants({ variant: "default" }), "min-h-11 w-full");
  const secondary = cn(buttonVariants({ variant: "outline" }), "min-h-11 w-full");

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 pt-8 pb-24">
      <Link href={`/courses/${slug}`} className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
        ← {catalog.title}
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          Module {meta.moduleSort} · {meta.moduleTitle}
        </p>
        <p className="text-sm text-muted-foreground">
          Lesson {posInModule} of {inModule.length}
        </p>
        <div className="h-1.5 w-full rounded bg-muted" role="progressbar" aria-valuenow={modulePct} aria-valuemin={0} aria-valuemax={100} aria-label="Module progress">
          <div className="h-1.5 rounded bg-primary" style={{ width: `${modulePct}%` }} />
        </div>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>
      {prog?.completed_at && <Chip tone="green">Done ✓</Chip>}
      {lesson.tldr && (
        <section className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-semibold">TL;DR</p>
          <p>{lesson.tldr}</p>
        </section>
      )}
      {/* Design, 2 Nov: paragraphs on blank lines, markdown symbols stripped, >=16px, ~1.6 line-height, ~65ch. */}
      <article className="flex max-w-[65ch] flex-col gap-3 text-base leading-relaxed">
        {toParagraphs(lesson.body_md).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </article>
      {lesson.takeaway && (
        <section className="rounded-lg border border-primary/50 p-4 text-sm">
          <p className="font-semibold">Key takeaway</p>
          <p>{lesson.takeaway}</p>
        </section>
      )}
      <LessonInteractive
        lessonId={meta.id}
        quiz={Array.isArray(quiz) ? (quiz as { q: string; options: string[] }[]) : null}
        practiceTask={lesson.practice_task}
        initialPractice={Boolean(prog?.practice_done)}
      />
      {next && (!nextIsNewModule || moduleDone) ? (
        <Link href={`/courses/${slug}/${next.slug}`} className={gold}>
          {nextIsNewModule ? `Next module → ${next.moduleTitle}` : `Next lesson → ${next.title}`}
        </Link>
      ) : next ? (
        <>
          <span className={cn(secondary, "opacity-60")} aria-disabled="true">Next module (pass the quiz first)</span>
          <p className="text-sm text-muted-foreground">Kailangan ng 80% sa quiz para ma-unlock ang next module.</p>
        </>
      ) : slug === "gold-reset" ? (
        <>
          <Link href={`/courses/${slug}`} className={gold}>Back to Gold Reset</Link>
          <Link href="/courses/gold-strategy-basics" className="inline-flex min-h-11 items-center text-sm underline">
            Kapag consistent ka na sa checklist, puwede mong tingnan ang Gold Strategy Basics.
          </Link>
        </>
      ) : (
        <>
          <Link href={`/courses/${slug}/capstone`} className={gold}>Go to capstone →</Link>
          <Link href={`/courses/${slug}`} className={secondary}>Back to course</Link>
        </>
      )}
      <MembersFooter />
    </div>
  );
}
