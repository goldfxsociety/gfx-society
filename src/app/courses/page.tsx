import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { ME } from "@/config/members-home";
import { cardPriceLine, COMING_LATER_COURSE_NOTE, INCLUDED_NOTE } from "@/config/training";
import { MembersNav } from "@/components/members-home/members-nav";
import { getAllCourseViews, type CourseView } from "@/lib/training/courses";
import { showMembersNav } from "@/lib/training/member-surface";
import { CONTINUE_ACTION_CLASS, continueHref, continueLabel, resolveContinue } from "@/lib/training/continue";
import { formatPht } from "@/lib/training/time";
import { Chip } from "@/components/training/chip";
import { GraceBanner } from "@/components/training/grace-banner";
import { MembersFooter } from "@/components/training/members-footer";

export const metadata: Metadata = { title: "Courses | GFX Trading System" };
export const dynamic = "force-dynamic";

const BTN = CONTINUE_ACTION_CLASS;

/** §1.4: owned/in-progress Continue (latest activity) > Gold Reset Start > Verify. */
function pickGold(views: CourseView[], member: boolean): string | null {
  if (!member) return "verify";
  const active = views
    .filter((v) => ["owned", "free_progress"].includes(v.state))
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
  if (active[0]) return active[0].catalog.slug;
  const reset = views.find((v) => v.state === "free_new");
  return reset ? reset.catalog.slug : null;
}

function CardAction({ v, gold }: { v: CourseView; gold: boolean }) {
  const slug = v.catalog.slug;
  const style = (g: boolean) => cn(buttonVariants({ variant: g ? "default" : "outline" }), BTN);
  const action = resolveContinue(v.lessons, v.capstone);
  const learnHref = continueHref(slug, action) ?? `/courses/${slug}`;
  const learnLabel = continueLabel(action, v.done, { start: "Start →", resume: "Continue →" }) ?? (v.done === 0 ? "Start →" : "Continue →");
  switch (v.state) {
    case "verify":
      return (
        <>
          <p className="text-sm text-muted-foreground">Members-only ang courses. I-verify muna ang member email mo.</p>
          <Link href="/system/join" className={style(gold)}>Verify membership →</Link>
        </>
      );
    case "free_new":
      return <Link href={learnHref} className={style(gold)}>{learnLabel}</Link>;
    case "free_progress":
    case "owned":
      return (
        <>
          {v.lessons.length > 0 && (
            <p className="text-sm text-muted-foreground">{v.done} of {v.lessons.length} lessons done</p>
          )}
          <Link href={learnHref} className={style(gold)}>
            {learnLabel}
          </Link>
        </>
      );
    case "free_done":
      return <Link href={learnHref} className={style(false)}>{learnLabel}</Link>;
    case "not_owned":
      return <Link href={`/courses/${slug}`} className={style(false)}>View course</Link>;
    case "pending":
      return (
        <>
          <p className="text-sm text-muted-foreground">
            Natanggap namin ang receipt mo noong {formatPht(v.pay.submitted_at)}. Tingnan ang status sa My courses.
          </p>
          <Link href="/account" className={style(false)}>View status</Link>
        </>
      );
    case "rejected":
      return (
        <>
          <p className="text-sm text-muted-foreground">Hindi na-approve: {v.pay.reject_reason}.</p>
          <Link href={`/courses/${slug}/pay`} className={style(false)}>Re-upload receipt →</Link>
        </>
      );
    case "locked":
      return (
        <>
          <p className="text-sm text-muted-foreground">{v.catalog.lockLine}</p>
          <Link href={`/courses/${slug}/placement`} className={style(false)}>Take placement quiz</Link>
          {v.catalog.prereqSlug && (
            <Link href={`/courses/${v.catalog.prereqSlug}`} className="inline-flex min-h-11 items-center text-sm underline">
              Go to Basics
            </Link>
          )}
        </>
      );
    case "sales_closed":
      return <p className="text-sm text-muted-foreground">{ME.lockedUnpaid}</p>;
    case "coming_soon":
      return <p className="text-sm text-muted-foreground">Inihahanda pa ang lessons. Wala pang bayad na tinatanggap.</p>;
  }
}

const CHIP: Record<CourseView["state"], [string, "neutral" | "amber" | "green" | "red" | "gold"] | null> = {
  verify: null,
  free_new: ["Free", "gold"],
  free_progress: ["In progress", "gold"],
  free_done: ["Done ✓", "green"],
  not_owned: ["Available", "neutral"],
  pending: ["Pending review", "amber"],
  rejected: ["Needs re-upload", "red"],
  owned: ["Owned ✓", "green"],
  coming_soon: ["Coming soon", "neutral"],
  locked: ["Locked", "neutral"],
  sales_closed: ["Locked", "neutral"],
};

export default async function CoursesPage() {
  const { membership, views } = await getAllCourseViews();
  const member = showMembersNav(membership);
  const gold = pickGold(views, member);

  const page = (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 pt-10 pb-24">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">GFX Trading System · Courses</p>
        <h1 className="text-2xl font-bold tracking-tight">Gold courses, step by step</h1>
        <p className="leading-relaxed">Self-paced, Taglish. Aralin sa sarili mong oras.</p>
      </header>

      {membership === "grace" && (
        <GraceBanner />
      )}

      <section className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">
        <p>{INCLUDED_NOTE}</p>
        <p className="mt-1 text-muted-foreground">{COMING_LATER_COURSE_NOTE}</p>
      </section>

      <ul className="flex flex-col gap-4">
        {views.map((v) => {
          const chip = CHIP[v.state];
          return (
            <li key={v.catalog.slug}>
              <article
                aria-label={`${v.catalog.title}, ${v.pricePhp > 0 ? cardPriceLine(v.pricePhp) : v.catalog.priceLine}, ${chip?.[0] ?? "members only"}`}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">
                    <Link href={`/courses/${v.catalog.slug}`} className="inline-flex min-h-11 items-center hover:underline">{v.catalog.title}</Link>
                  </h2>
                  {chip && <Chip tone={chip[1]}>{chip[0]}</Chip>}
                </div>
                <p className="text-sm font-semibold">{v.pricePhp > 0 ? cardPriceLine(v.pricePhp) : v.catalog.priceLine}</p>
                <p className="text-sm">{v.catalog.forWho}</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {v.catalog.included.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2">
                  <CardAction v={v} gold={gold === v.catalog.slug || (gold === "verify" && v.catalog.slug === "gold-reset")} />
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      <MembersFooter />
    </div>
  );
  if (!member) return page;
  return (
    <div className="mx-auto flex w-full flex-1 gap-8 lg:max-w-6xl lg:px-4">
      <MembersNav active="courses" />
      <div className="flex min-w-0 flex-1">{page}</div>
    </div>
  );
}
