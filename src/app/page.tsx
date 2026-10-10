import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "cn";
import { FIRST_LESSON_PATH, MESSENGER_COMMUNITY_URL } from "@/config/academy";

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
    title: "Risk-first, demo-first",
    body: "We teach 1% max risk per trade and a stop-loss on every trade. Practise on demo before any real money.",
  },
  {
    icon: "💬",
    title: "A beginner community",
    body: "Ask questions and learn with other Filipino beginners in the GFX Society Messenger community.",
  },
];

export default async function Home() {
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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <section className="flex flex-col gap-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          GFX Society · Free gold trading education
        </span>
        <h1 className="text-3xl font-bold tracking-tight">
          {user
            ? `Welcome back${profileName ? `, ${profileName}` : ""}!`
            : "Learn gold trading step by step — risk first, libre."}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          GFX Society is a free, beginner-friendly Academy for Filipinos who are
          curious about trading gold (XAUUSD). Short lessons in plain language,
          practice tools, and a community — with risk management first, not
          quick profits.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={FIRST_LESSON_PATH}
            className={cn(buttonVariants({ variant: "default" }), "h-11 px-5")}
          >
            Start Lesson 1 →
          </Link>
          <Link
            href="/start"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}
          >
            New here? See the Start-here path
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          No signup needed to learn. A free account just saves your progress.
        </p>
      </section>

      <section aria-labelledby="offers" className="flex flex-col gap-3">
        <h2 id="offers" className="text-lg font-semibold">
          What you get
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {offers.map((o) => (
            <div key={o.title} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">
                <span aria-hidden="true">{o.icon}</span> {o.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{o.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Join the GFX Society community</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Learning is easier together. Ask questions as you go through the Academy.
        </p>
        <a
          href={MESSENGER_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "mt-3 h-11 w-full")}
        >
          Join the Messenger community →
        </a>
      </section>

      <section
        aria-label="Risk warning"
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs leading-relaxed"
      >
        <p>
          <strong>Demo first.</strong> Practise on a free demo account. Max 1%
          risk per trade, stop-loss on every trade.
        </p>
        <p className="mt-1 text-muted-foreground">
          Education only, not financial advice. Trading gold, forex and CFDs
          with leverage carries a high risk of losing money quickly. Never trade
          money you can&apos;t afford to lose. Education lang, hindi financial
          advice — demo muna.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {user ? (
          <>
            <Link href="/dashboard" className="underline">
              My dashboard
            </Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/signup" className="underline">
              Create a free account
            </Link>
            <Link href="/login" className="underline">
              Log in
            </Link>
          </>
        )}
        <Link href="/resources" className="underline">
          Resources
        </Link>
        <Link href="/broker" className="underline">
          Broker info
        </Link>
      </div>
    </div>
  );
}
