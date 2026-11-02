import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { APPROVAL_TIME, BUY_ENABLED, COMING_LATER_COURSE_NOTE, peso } from "@/config/training";
import { findCatalog, getCourseView, groupByModule, nextLesson } from "@/lib/training/courses";
import { getMembership } from "@/lib/training/gate";
import { Chip } from "@/components/training/chip";
import { MembersFooter } from "@/components/training/members-footer";
import { RefundLine } from "@/components/training/refund-line";
import { Curriculum } from "@/components/members-home/curriculum";
import { MembersNav } from "@/components/members-home/members-nav";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${findCatalog(slug)?.title ?? "Course"} | GFX Trading System` };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = findCatalog(slug);
  if (!catalog) notFound();
  const { membership } = await getMembership();
  const v = await getCourseView(catalog, membership);
  const paid = v.pricePhp > 0;
  const gold = cn(buttonVariants({ variant: "default" }), "h-auto min-h-11 w-full whitespace-normal py-2 text-center");
  const secondary = cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 w-full whitespace-normal py-2 text-center");
  const next = nextLesson(v.lessons);
  const member = membership !== "none";

  const page = (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 pt-8 pb-24">
      <Link href="/courses" className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
        ← All courses
      </Link>
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">GFX Trading System · Course</p>
        <h1 className="text-2xl font-bold tracking-tight">{catalog.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{paid ? `${peso(v.pricePhp)} · one-time` : catalog.priceLine}</span>
          {v.state === "owned" && <Chip tone="green">Owned ✓</Chip>}
          {v.state === "pending" && <Chip tone="amber">Pending review</Chip>}
          {v.state === "rejected" && <Chip tone="red">Needs re-upload</Chip>}
          {v.state === "coming_soon" && <Chip>Coming soon</Chip>}
          {v.state === "locked" && <Chip>Locked</Chip>}
        </div>
        {paid && <RefundLine />}
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Para kanino</h2>
        <p className="text-sm">{catalog.forWho}</p>
        {catalog.lockLine && <p className="text-sm text-muted-foreground">{catalog.lockLine}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">What&apos;s included</h2>
        <ul className="list-disc pl-5 text-sm">
          {catalog.included.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        {paid && <p className="text-sm text-muted-foreground">{COMING_LATER_COURSE_NOTE}</p>}
      </section>

      <section className="flex flex-col gap-2" id="modules">
        <h2 className="text-lg font-semibold">Modules</h2>
        {v.lessons.length > 0 ? (
          // Spec §3.2: 3 states (✓ / ◐ / ○, icon + text) + X/Y bar; current module open with "Current".
          <Curriculum slug={slug} lessons={v.lessons} hasCapstone={false} currentLessonId={next?.id} idPrefix="mod-" />
        ) : (
          <ol className="flex flex-col gap-1">
            {catalog.modules.map((m, i) => (
              <li key={m} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                <span aria-hidden>🔒</span>
                <span>
                  Module {i + 1}, {m}
                  {paid ? `. Included with ${catalog.title}.` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        {(v.state === "owned" || v.state.startsWith("free_")) && (
          <Link href={`/courses/${slug}/capstone`} className="inline-flex min-h-11 items-center self-start text-sm underline">
            Capstone (self-check)
          </Link>
        )}
      </section>

      <section className="flex flex-col gap-2">
        {v.state === "verify" && (
          <>
            <p className="text-sm text-muted-foreground">Members-only ito. I-verify ang member email mo.</p>
            <Link href="/system/join" className={gold}>Verify membership →</Link>
          </>
        )}
        {v.state === "not_owned" &&
          (BUY_ENABLED ? (
            <>
              <Link href={`/courses/${slug}/pay`} className={gold}>Buy course · {peso(v.pricePhp)} →</Link>
              <p className="text-sm text-muted-foreground">Manual GCash payment. Ive-verify ni GFX ang receipt bago ma-unlock.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Hindi pa bukas ang bayad para sa course na ito.</p>
          ))}
        {v.state === "pending" && (
          <>
            <p className="text-sm">Pending review: ive-verify pa ang receipt mo within {APPROVAL_TIME}. Tingnan ang status sa My courses.</p>
            <Link href="/account" className={secondary}>Tingnan ang status sa My courses</Link>
          </>
        )}
        {v.state === "rejected" && (
          <>
            <p className="text-sm">Hindi na-approve: {v.pay.reject_reason}.</p>
            <Link href={`/courses/${slug}/pay`} className={gold}>Re-upload receipt →</Link>
          </>
        )}
        {(v.state === "owned" || v.state === "free_new" || v.state === "free_progress" || v.state === "free_done") && next && (
          <Link href={`/courses/${slug}/${next.slug}`} className={gold}>
            {v.done === 0 ? "Start →" : `Continue: ${next.title} →`}
          </Link>
        )}
        {v.state === "locked" && (
          <>
            <Link href={`/courses/${slug}/placement`} className={secondary}>Take placement quiz</Link>
            {catalog.prereqSlug && (
              <Link href={`/courses/${catalog.prereqSlug}`} className="inline-flex min-h-11 items-center text-sm underline">Go to Basics</Link>
            )}
          </>
        )}
        {v.state === "coming_soon" && (
          <p className="text-sm text-muted-foreground">Inihahanda pa ang lessons. Wala pang bayad na tinatanggap.</p>
        )}
      </section>
      <MembersFooter />
    </div>
  );
  // Members only (spec §3.3): members get the Home · Courses · Account nav; everyone else keeps the Academy nav.
  if (!member) return page;
  return (
    <div className="mx-auto flex w-full flex-1 gap-8 lg:max-w-6xl lg:px-4">
      <MembersNav
        active="courses"
        course={v.lessons.length > 0 ? { slug, title: catalog.title, modules: groupByModule(v.lessons) } : undefined}
      />
      <div className="flex min-w-0 flex-1">{page}</div>
    </div>
  );
}
