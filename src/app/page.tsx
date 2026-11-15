import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "cn";
import { FIRST_LESSON_PATH } from "@/config/academy";
import { RISK_LINE } from "@/config/training";
import { JOIN_SYSTEM_CTA } from "@/content/access-request";
import { Expander } from "@/components/layout/expander";
import { MEMBERS_ONLY_HINT } from "@/content/members-gate";
import { IbDisclosureShort } from "@/components/compliance/ib-disclosure";

function academyBody(lessons: number | null, levels: number | null) {
  const size =
    lessons && levels ? `${lessons} short lessons, ${levels} levels` : "Short lessons, step by step";
  return `${size} — from \u201cwhat is the market?\u201d to building your own trading plan. Walang bayad.`;
}

const OFFERS = [
  {
    icon: "🧮",
    title: "Hands-on tools",
    body: "Lot-size and risk-reward calculators, candlestick practice, quizzes, and a Manila-time session checker.",
  },
  {
    icon: "🛡️",
    title: "Risk-first, start small",
    body: "We teach max 1% risk per trade at laging may stop loss. Kung magte-trade ka, start sa cents account na pera lang na kaya mong mawala, para ma-train ang emotions mo. Walang profit promises.",
  },
  {
    icon: "🎓",
    title: "Aral muna, walang pressure",
    body: "Libre ang Academy, at puwede kang mag-aral dito hangga't kailangan mo. Kapag ready ka na, join the Trading System.",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; deleted?: string }>;
}) {
  const sp = await searchParams;
  const isNewAccount = sp.welcome === "new";
  const justDeleted = sp.deleted === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    profileName = profile?.display_name ?? null;
  }

  // Published counts only; on any error fall back to copy without numbers.
  let lessonCount: number | null = null;
  let levelCount: number | null = null;
  try {
    const [lessonsRes, levelsRes] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, levels!inner(is_published)", { count: "exact", head: true })
        .eq("is_published", true)
        .eq("levels.is_published", true),
      supabase
        .from("levels")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true),
    ]);
    if (!lessonsRes.error) lessonCount = lessonsRes.count ?? null;
    if (!levelsRes.error) levelCount = levelsRes.count ?? null;
  } catch {
    // fallback copy
  }
  const offers = [
    { icon: "🎓", title: "Free GFX Academy", body: academyBody(lessonCount, levelCount) },
    ...OFFERS,
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      {justDeleted && (
        <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm">
          Na-delete na ang account mo. Salamat sa pag-aaral with GFX Society. Pwede ka pa ring mag-aral sa
          Academy kahit walang account.
        </p>
      )}
      {/* Simplicity spec v2 (Ben, decision 1): gold = Join the Trading System; Lesson 1 is the outline second door. */}
      <section lang="fil" className="flex flex-col gap-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">GFX Society · Free education</span>
        <h1 className="text-3xl font-bold tracking-tight">
          {user
            ? isNewAccount
              ? `Welcome${profileName ? `, ${profileName}` : ""}! Simulan na natin ang Lesson 1.`
              : `Welcome back${profileName ? `, ${profileName}` : ""}!`
            : "Learn gold trading, step by step."}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">Libre, risk-first lessons para sa beginners.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/system/join" className={cn(buttonVariants({ variant: "default" }), "h-11 px-5")}>
            {JOIN_SYSTEM_CTA}
          </Link>
          <Link href={FIRST_LESSON_PATH} className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}>
            Start Lesson 1 →
          </Link>
        </div>
        {/* QA P3-6: say members-only before the Join click (minimal on Home). */}
        <p className="text-xs text-muted-foreground" data-testid="members-only-hint">{MEMBERS_ONLY_HINT}</p>
        <p className="text-sm text-muted-foreground">
          {user ? "Naka-save na ang progress mo sa account mo." : "No signup needed to learn."}
        </p>
        <Expander summary="Learn more" testId="learn-more">
          {offers.map((o) => (
            <p key={o.title}>
              <span className="font-semibold text-foreground">
                <span aria-hidden="true">{o.icon}</span> {o.title}.
              </span>{" "}
              {o.body}
            </p>
          ))}
          <p>
            <Link href="/start" className="inline-flex min-h-11 items-center text-foreground underline">
              New here? See the Start-here path
            </Link>
          </p>
        </Expander>
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {user ? (
          <>
            <Link href="/dashboard" className="inline-flex min-h-11 items-center underline">
              My dashboard
            </Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/signup" className="inline-flex min-h-11 items-center underline">
              Create a free account
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center underline">
              Log in
            </Link>
          </>
        )}
      </div>

      <footer className="flex flex-col gap-1" data-testid="home-footer">
        <p className="text-xs text-muted-foreground" data-testid="risk-line">{RISK_LINE}</p>
        <IbDisclosureShort />
      </footer>
    </div>
  );
}
