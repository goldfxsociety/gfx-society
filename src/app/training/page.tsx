import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Play, BookOpen, Zap, UserRound } from "lucide-react";
import { ME } from "@/config/members-home";
import { createClient } from "@/lib/supabase/server";
import { formatPhtDate } from "@/lib/training/time";
import { getAllCourseViews, groupByModule } from "@/lib/training/courses";
import { CONTINUE_ACTION_CLASS, continueHref, continueLabel, resolveContinue, showCurriculumCapstone } from "@/lib/training/continue";
import { MembersFooter } from "@/components/training/members-footer";
import { Curriculum } from "@/components/members-home/curriculum";
import { MembersNav } from "@/components/members-home/members-nav";
import { ExplorerSeen, FlipBanner } from "@/components/members/flip-banner";
import { GraceBanner } from "@/components/training/grace-banner";
import { joinPath } from "@/lib/members/routes";
import { GOLD_RESET_PATH, homeGold } from "@/lib/members/tier";
import { getTier } from "@/lib/members/tier-server";

export const metadata: Metadata = { title: "Training | GFX Trading System", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const { loggedIn, membership, views } = await getAllCourseViews();
  if (!loggedIn) redirect("/login?next=/training");
  // Sprint 3 (explorer-linked-tiers-spec §2.1): confirmed Explorers land here too. Unconfirmed -> join door copy.
  const t = await getTier({ loggedIn, membership });
  if (t.tier === "guest") redirect("/system/join");
  const explorer = t.tier === "explorer";

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
  const action = current ? resolveContinue(current.lessons, current.capstone) : ({ kind: "empty" } as const);
  const lesson = action.kind === "lesson" ? action.lesson : undefined;
  const capVisible = current ? showCurriculumCapstone(current.lessons.length, current.capstone) : false;
  const finished =
    current && (action.kind === "capstone" || action.kind === "review")
      ? {
          label: continueLabel(action, current.done, { start: ME.heroCta, resume: ME.heroCta }) ?? "",
          href: continueHref(current.catalog.slug, action) ?? `/courses/${current.catalog.slug}`,
          title: current.catalog.title,
        }
      : null;
  const modules = current ? groupByModule(current.lessons) : [];
  // One gold CTA (§2.1): lesson / course end / consent-first Gold Reset / Link once Gold Reset is done.
  const { gold, outlineLink } = homeGold({ tier: t.tier, consented: t.consented, action: action.kind });
  const showOutlineLink = outlineLink && !t.pending; // pending: no second request path on this screen
  const goldClass = cn(buttonVariants({ variant: "default" }), CONTINUE_ACTION_CLASS);

  const H = ME.home;
  const card = "flex min-w-0 gap-3 rounded-lg border border-border bg-card p-4";
  const icon = "inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary";

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 gap-8 px-4 lg:max-w-6xl">
      <MembersNav
        active="home"
        course={current ? { slug: current.catalog.slug, title: current.catalog.title, modules } : undefined}
      />
      <div lang="fil" className="flex min-w-0 flex-1 flex-col gap-4 pt-8 pb-24">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">{ME.eyebrow}</p>
          <h1 className="text-2xl font-bold tracking-tight">{ME.welcome(first)}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {explorer ? H.explorerLead : H.lead}
            <span className="flex items-center gap-1.5 text-xs font-medium" data-testid="member-badge">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", explorer ? "bg-muted-foreground" : membership === "active" ? "bg-green-400" : "bg-amber-400")}
              />
              {explorer ? ME.badgeExplorer : membership === "grace" && graceDate ? ME.badgeGrace(graceDate) : ME.badgeActive}
            </span>
          </p>
          {explorer && t.pending && (
            <p className="text-sm text-muted-foreground" data-testid="pending-status">
              {H.pendingStatus}{" "}
              <Link href="/system/join" className="inline-flex min-h-11 items-center underline">
                {H.pendingLink}
              </Link>
            </p>
          )}
          {!explorer && <p className="text-sm text-muted-foreground" data-testid="linked-status">{H.linkedStatus}</p>}
        </header>
        {explorer ? <ExplorerSeen /> : <FlipBanner text={H.flipBanner} />}
        {membership === "grace" && <GraceBanner />}

        {/* 4 cards (simplicity spec v2 P1.3): Continue training (the one gold), Courses, Signals (coming soon), Account. */}
        <ul className="flex flex-col gap-3" aria-label="Member home">
          {/* 1. Continue training: the one gold CTA. Finished courses use an explicit capstone or review action. */}
          <li>
            <section aria-labelledby="hero-h" className={cn(card, "flex-col border-primary/60")} data-testid="card-continue">
              <div className="flex gap-3">
                <span aria-hidden className={icon}>
                  <Play className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="hero-h" className="text-lg font-semibold">{H.continueTitle}</h2>
                  <p className="text-sm break-words text-muted-foreground">
                    {current && lesson ? lesson.title : finished ? finished.title : ME.heroEmpty}
                  </p>
                  {current && lesson && fresh && <p className="text-xs text-muted-foreground">{ME.heroEmpty}</p>}
                </div>
              </div>
              {gold.kind === "lesson" && current && lesson ? (
                <Link href={`/courses/${current.catalog.slug}/${lesson.slug}`} className={goldClass}>
                  {ME.heroCta}
                </Link>
              ) : gold.kind === "finished" && finished ? (
                <Link href={finished.href} className={goldClass}>
                  {finished.label}
                </Link>
              ) : gold.kind === "consent" ? (
                // Explorer without join-v2: consent first on the join door, then straight back into Gold Reset.
                <Link href={joinPath(GOLD_RESET_PATH)} className={goldClass} data-testid="home-gold-consent">
                  {ME.heroCta}
                </Link>
              ) : gold.kind === "link" ? (
                <Link href="/system/join" className={goldClass} data-testid="home-gold-link">
                  {H.linkCta}
                </Link>
              ) : null}
            </section>
          </li>
          {/* 2. Courses */}
          <li>
            <Link href="/courses" className={cn(card, "hover:bg-muted/40")} data-testid="card-courses">
              <span aria-hidden className={icon}>
                <BookOpen className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold">{H.coursesTitle}</span>
                <span className="block text-sm text-muted-foreground">{H.coursesLine}</span>
              </span>
            </Link>
          </li>
          {/* 3. Signals: placeholder only. Not a link or button, not focusable, no hover, no gold, no dates, no claims. */}
          <li>
            <div aria-disabled="true" className={cn(card, "items-center opacity-60")} data-testid="card-signals">
              <span aria-hidden className={cn(icon, "text-muted-foreground")}>
                <Zap className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{H.signalsTitle}</span>
                <span className="block text-sm text-muted-foreground">{H.signalsLine}</span>
              </span>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{H.signalsBadge}</span>
            </div>
          </li>
          {/* 4. Account */}
          <li>
            <Link href="/account" className={cn(card, "hover:bg-muted/40")} data-testid="card-account">
              <span aria-hidden className={icon}>
                <UserRound className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold">{H.accountTitle}</span>
                <span className="block text-sm text-muted-foreground">{H.accountLine}</span>
              </span>
            </Link>
          </li>
        </ul>

        {showOutlineLink && (
          <Link href="/system/join" className={cn(buttonVariants({ variant: "outline" }), CONTINUE_ACTION_CLASS)} data-testid="home-link-outline">
            {H.linkCta}
          </Link>
        )}

        <MembersFooter />
      </div>

      {current && (
        <aside aria-label={ME.railTitle} className="hidden w-[300px] shrink-0 pt-10 pb-24 lg:block">
          <h2 className="mb-3 font-semibold">
            {ME.railTitle} · {current.catalog.title}
          </h2>
          <Curriculum
            slug={current.catalog.slug}
            lessons={current.lessons}
            hasCapstone={capVisible}
            currentLessonId={lesson?.id}
            capstoneCurrent={action.kind === "capstone"}
          />
        </aside>
      )}
    </div>
  );
}
