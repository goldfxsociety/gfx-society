import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { APPROVAL_TIME, BUY_ENABLED } from "@/config/training";
import { findCatalog, getCourseView, nextLesson } from "@/lib/training/courses";
import { getMembership } from "@/lib/training/gate";
import { Chip } from "@/components/training/chip";
import { MembersFooter } from "@/components/training/members-footer";
import { RefundLine } from "@/components/training/refund-line";

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
  const paid = catalog.priceLine.startsWith("₱");
  const gold = cn(buttonVariants({ variant: "default" }), "min-h-11 w-full");
  const secondary = cn(buttonVariants({ variant: "outline" }), "min-h-11 w-full");
  const next = nextLesson(v.lessons);
  const byModule = new Map<string, typeof v.lessons>();
  for (const l of v.lessons) byModule.set(l.moduleTitle, [...(byModule.get(l.moduleTitle) ?? []), l]);

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 pt-8 pb-24">
      <Link href="/courses" className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
        ← All courses
      </Link>
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">{catalog.title}</p>
        <h1 className="text-2xl font-bold tracking-tight">{catalog.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{catalog.priceLine}</span>
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
      </section>

      <section className="flex flex-col gap-2" id="modules">
        <h2 className="text-lg font-semibold">Modules</h2>
        {v.lessons.length > 0 ? (
          [...byModule.entries()].map(([mod, lessons]) => (
            <details key={mod} className="rounded-lg border border-border p-3" open>
              <summary className="min-h-11 cursor-pointer content-center font-medium">{mod}</summary>
              <ul className="mt-2 flex flex-col">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link href={`/courses/${slug}/${l.slug}`} className="flex min-h-11 items-center justify-between text-sm underline">
                      <span>{l.title}</span>
                      {l.completed && <span aria-label="done">✓</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))
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
              <Link href={`/courses/${slug}/pay`} className={gold}>Buy course · {catalog.priceLine.replace(" · one-time", "")} →</Link>
              <p className="text-sm text-muted-foreground">Manual GCash payment. Ive-verify ni GFX ang receipt bago ma-unlock.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Hindi pa bukas ang bayad para sa course na ito.</p>
          ))}
        {v.state === "pending" && (
          <>
            <p className="text-sm">Pending review: ive-verify pa ang receipt mo within {APPROVAL_TIME}. Check /account for updates.</p>
            <Link href="/account" className={secondary}>View status in /account</Link>
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
}
