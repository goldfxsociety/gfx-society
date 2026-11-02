import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { COMING_LATER_COURSE_NOTE } from "@/config/training";
import { ME } from "@/config/members-home";
import { createClient } from "@/lib/supabase/server";
import { formatPhtDate } from "@/lib/training/time";
import {
  findCatalog,
  getAllCourseViews,
  getCapstoneStatus,
  groupByModule,
  nextLesson,
  type CourseView,
} from "@/lib/training/courses";
import { Chip } from "@/components/training/chip";
import { MembersFooter } from "@/components/training/members-footer";
import { Curriculum } from "@/components/members-home/curriculum";
import { MembersNav } from "@/components/members-home/members-nav";
import { ProgressBar } from "@/components/members-home/progress-bar";

export const metadata: Metadata = { title: "Training | GFX Trading System", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Course-list status line (spec §5 locked/prereq strings). Text + icon, never color alone. */
function courseStatus(v: CourseView) {
  switch (v.state) {
    case "not_owned":
      return <p className="text-sm text-muted-foreground">{ME.lockedUnpaid}</p>;
    case "coming_soon":
      return <p className="text-sm text-muted-foreground">{ME.lockedNoContent}</p>;
    case "locked": {
      const pre = v.catalog.prereqSlug ? findCatalog(v.catalog.prereqSlug)?.title : undefined;
      return <p className="text-sm text-muted-foreground">🔒 {pre ? ME.prereq(pre) : v.catalog.lockLine}</p>;
    }
    case "pending":
      return <Chip tone="amber">Pending review</Chip>;
    case "rejected":
      return <Chip tone="red">Needs re-upload</Chip>;
    default:
      return v.lessons.length > 0 ? (
        <ProgressBar value={v.done} max={v.lessons.length} label={ME.railDone(v.done, v.lessons.length)} />
      ) : null;
  }
}

export default async function TrainingPage() {
  const { loggedIn, membership, views } = await getAllCourseViews();
  if (!loggedIn) redirect("/login?next=/training");
  if (membership === "none") redirect("/system/join");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A2: first name from profiles.display_name (own row) if set; else plain "Welcome back."
  const [{ data: profile }, { data: status }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user?.id ?? "").maybeSingle(),
    membership === "grace"
      ? supabase.from("member_status").select("grace_until").eq("user_id", user?.id ?? "").maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const first = (profile?.display_name as string | null | undefined)?.trim().split(/\s+/)[0] || null;
  const graceDate = formatPhtDate((status as { grace_until?: string } | null)?.grace_until);

  const withLessons = views.filter((v) => v.lessons.length > 0);
  const started = withLessons
    .filter((v) => v.lastActivity)
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
  // Hero: latest activity; with no activity anywhere, start at Gold Reset (hero empty copy).
  const current = started[0] ?? withLessons.find((v) => v.catalog.slug === "gold-reset") ?? withLessons[0];
  const fresh = !started[0];
  const lesson = current ? nextLesson(current.lessons) : undefined;
  const cap = current?.courseId ? await getCapstoneStatus(current.courseId) : { exists: false, done: false };
  const modules = current ? groupByModule(current.lessons) : [];
  const mod = modules.find((m) => m.sort === lesson?.moduleSort);
  const checkpoints = mod && lesson ? mod.lessons.filter((l) => !l.completed && l.id !== lesson.id).slice(0, 3) : [];
  const quizDone = current ? current.lessons.filter((l) => l.quizDone).length : 0;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 gap-8 px-4 lg:max-w-6xl">
      <MembersNav
        active="home"
        course={current ? { slug: current.catalog.slug, title: current.catalog.title, modules } : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-5 pt-10 pb-24">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">{ME.eyebrow}</p>
          <h1 className="text-2xl font-bold tracking-tight">Training</h1>
        </header>

        {/* 1. Welcome bar */}
        <section aria-label="Membership" className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
          <span className="flex items-center gap-2 text-sm">
            <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-full bg-muted font-semibold">
              {(first ?? "G").charAt(0).toUpperCase()}
            </span>
            {ME.welcome(first)}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium" data-testid="member-badge">
            <span aria-hidden className={cn("size-2 rounded-full", membership === "active" ? "bg-green-400" : "bg-amber-400")} />
            {membership === "grace" && graceDate ? ME.badgeGrace(graceDate) : ME.badgeActive}
          </span>
        </section>

        {/* 2. Continue card: the one gold CTA */}
        {current && lesson ? (
          <section aria-labelledby="hero-h" className="flex flex-col gap-3 rounded-lg border-2 border-primary p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">{ME.heroLabel}</p>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{lesson.moduleTitle}</span>
            </div>
            {fresh && <p className="text-sm">{ME.heroEmpty}</p>}
            <h2 id="hero-h" className="text-lg font-bold">
              {lesson.title}
            </h2>
            <p className="text-xs text-muted-foreground">{current.catalog.title}</p>
            {/* Goal line: module learning goal. No minutes column exists, so minutes are omitted (§4.4). */}
            {lesson.moduleGoal && <p className="text-sm text-muted-foreground">{lesson.moduleGoal}</p>}
            {checkpoints.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {checkpoints.map((c) => (
                  <li key={c.id}>{c.title}</li>
                ))}
              </ul>
            )}
            <Link
              href={`/courses/${current.catalog.slug}/${lesson.slug}`}
              className={cn(buttonVariants({ variant: "default" }), "min-h-11 w-full sm:w-auto sm:self-start")}
            >
              {ME.heroCta}
            </Link>
          </section>
        ) : (
          <p className="rounded-lg border border-border p-4 text-sm">{ME.heroEmpty}</p>
        )}

        {/* 3. Program card + stat chips (counts only) */}
        {current && (
          <section aria-label={`${current.catalog.title} progress`} className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <h2 className="font-semibold">{current.catalog.title}</h2>
            <p className="text-sm text-muted-foreground">{current.catalog.forWho}</p>
            <ul className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap sm:divide-x sm:divide-border sm:gap-0">
              <li className="rounded-md border border-border px-3 py-2 sm:rounded-none sm:border-0 sm:py-0">
                {ME.chipLessons(current.done, current.lessons.length)}
              </li>
              <li className="rounded-md border border-border px-3 py-2 sm:rounded-none sm:border-0 sm:py-0">{ME.chipQuiz(quizDone)}</li>
              {cap.exists && (
                <li className="rounded-md border border-border px-3 py-2 sm:rounded-none sm:border-0 sm:py-0">
                  {cap.done ? "✓ " : "○ "}
                  {ME.chipCapstone(cap.done)}
                </li>
              )}
            </ul>
          </section>
        )}

        {/* 360px: curriculum accordion, collapsed. Desktop shows the right rail instead. */}
        {current && (
          <div className="lg:hidden">
            <Curriculum slug={current.catalog.slug} lessons={current.lessons} hasCapstone={cap.exists} currentLessonId={lesson?.id} collapsed />
          </div>
        )}

        {/* 4. Course list */}
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Courses</h2>
          <ul className="flex flex-col gap-2">
            {views.map((v) => (
              <li key={v.catalog.slug}>
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <Link href={`/courses/${v.catalog.slug}`} className="inline-flex min-h-11 items-center text-sm font-medium underline">
                    {v.catalog.title}
                  </Link>
                  {courseStatus(v)}
                </div>
              </li>
            ))}
          </ul>
          <Link href="/academy" className="inline-flex min-h-11 items-center self-start text-sm underline">
            Free Academy lessons →
          </Link>
        </section>

        {/* Ideas + Chat: one muted "Paparating pa" line, not in the nav (decision 4). Existing E3 line, once per page. */}
        <p className="text-sm text-muted-foreground">{COMING_LATER_COURSE_NOTE}</p>
        <MembersFooter />
      </div>

      {current && (
        <aside aria-label={ME.railTitle} className="hidden w-[300px] shrink-0 pt-10 pb-24 lg:block">
          <h2 className="mb-3 font-semibold">
            {ME.railTitle} · {current.catalog.title}
          </h2>
          <Curriculum slug={current.catalog.slug} lessons={current.lessons} hasCapstone={cap.exists} currentLessonId={lesson?.id} />
        </aside>
      )}
    </div>
  );
}
