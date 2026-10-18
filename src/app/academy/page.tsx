import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "GFX Academy — Free Gold Trading Course",
  description: "Free, beginner-friendly gold (XAUUSD) trading lessons para sa mga Pinoy: basics, risk management, at paano mag-start small. Education only.",
  alternates: { canonical: "/academy" },
  openGraph: { title: "GFX Academy — Free Gold Trading Course", description: "Free, beginner-friendly gold (XAUUSD) trading lessons para sa mga Pinoy: basics, risk management, at paano mag-start small. Education only.", url: "/academy", images: ["/opengraph-image"] },
};


export default async function AcademyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: levels } = await supabase
    .from("levels")
    .select("id, slug, title, description, order_index, lessons(count)")
    .eq("is_published", true)
    .order("order_index");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          GFX Academy
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Your Learning Path
        </h1>
      </div>

      {/* One "Start here" door; Starter Kit folded under it (UX audit #10). */}
      <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/10 p-4">
        <p className="text-base font-semibold">New here? Start here.</p>
        <p className="text-sm text-muted-foreground">Your first steps, no signup needed.</p>
        <Link href="/start" className={cn(buttonVariants({ variant: "default" }), "h-12 w-full text-base")}>
          Start here →
        </Link>
        <Link href="/academy/gold-starter" className="inline-flex min-h-11 items-center text-sm underline">
          Or try the Gold Basics Starter Kit (Taglish, 5 steps + 7-day checklist)
        </Link>
      </div>

      <Link
        href="/diagnostic"
        className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 w-full whitespace-normal py-2 text-sm")}
      >
        {user ? "Already know the basics? Take the GFX Diagnostic" : "Already know the basics? GFX Diagnostic (free account)"}
      </Link>

      <div className="flex flex-col gap-3">
        {(levels ?? []).map((level) => {
          const lessonCount = Array.isArray(level.lessons)
            ? (level.lessons[0] as { count: number } | undefined)?.count ?? 0
            : 0;
          return (
            <Link key={level.id} href={`/academy/${level.slug}`}>
              <Card className="transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle>{level.title}</CardTitle>
                  <CardDescription>{level.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {(!levels || levels.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No levels published yet — check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
