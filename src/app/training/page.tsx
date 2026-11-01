import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { COMING_LATER_NOTE } from "@/config/training";
import { getAllCourseViews, nextLesson } from "@/lib/training/courses";
import { Chip } from "@/components/training/chip";
import { MembersFooter } from "@/components/training/members-footer";

export const metadata: Metadata = { title: "Training | GFX Trading System", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const { loggedIn, membership, views } = await getAllCourseViews();
  if (!loggedIn) redirect("/login?next=/training");
  if (membership === "none") redirect("/system/join");

  const active = views
    .filter((v) => v.lessons.length > 0)
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
  const resume = active[0];
  const resumeLesson = resume ? nextLesson(resume.lessons) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 pt-10 pb-24">
      <h1 className="text-2xl font-bold tracking-tight">Training</h1>
      {resume && resumeLesson ? (
        <Link
          href={`/courses/${resume.catalog.slug}/${resumeLesson.slug}`}
          className={cn(buttonVariants({ variant: "default" }), "min-h-11 w-full")}
        >
          Continue where you left off →
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">Wala pang lesson na bukas. Tingnan ang courses sa baba.</p>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">L0 Foundations</h2>
        <Link href="/academy" className="inline-flex min-h-11 items-center text-sm underline">
          Free Academy lessons →
        </Link>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Courses</h2>
        <ul className="flex flex-col gap-2">
          {views.map((v) => (
            <li key={v.catalog.slug}>
              <Link
                href={`/courses/${v.catalog.slug}`}
                className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border px-3 text-sm"
              >
                <span>
                  {v.lessons.length === 0 && <span aria-hidden>🔒 </span>}
                  {v.catalog.title}
                </span>
                {v.lessons.length > 0 ? (
                  <Chip tone={v.done === v.lessons.length ? "green" : "gold"}>
                    {v.done} of {v.lessons.length}
                  </Chip>
                ) : v.state === "coming_soon" ? (
                  <Chip>Coming soon</Chip>
                ) : v.state === "pending" ? (
                  <Chip tone="amber">Pending review</Chip>
                ) : v.state === "locked" ? (
                  <Chip>Locked</Chip>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-muted-foreground">{COMING_LATER_NOTE}</p>
      <MembersFooter />
    </div>
  );
}
