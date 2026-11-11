import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findCatalog, getPaymentInfo } from "@/lib/training/courses";
import { getMembership } from "@/lib/training/gate";
import { ContentDisclaimerFooter } from "@/components/training/content-disclaimer-footer";
import { CapstoneChecklist } from "./capstone-checklist";
import { Chip } from "@/components/training/chip";
import { buttonVariants } from "@/components/ui/button";
import { APPROVAL_TIME, cardPriceLine } from "@/config/training";
import { cn } from "cn";

export const metadata: Metadata = { title: "Capstone | GFX", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CapstonePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = findCatalog(slug);
  if (!catalog) notFound();
  const { loggedIn, membership } = await getMembership();
  if (!loggedIn) redirect(`/login?next=/courses/${slug}/capstone`);
  const info = await getPaymentInfo(slug);
  // S8 = A: a removed member keeps the capstone of a bought course.
  if (membership === "none" && info.state !== "approved") redirect("/system/join");
  if (!info.course_id) redirect(`/courses/${slug}`);
  const owner = info.state === "approved" || info.state === "free";
  // E8.4: non-owners never query or see the capstone ("Inihahanda pa" is for owners only).
  if (!owner) {
    const closed = info.state === "locked" || info.state === "closed" || info.state === "coming_soon";
    const price = !closed && typeof info.price_php === "number" && info.price_php > 0 ? cardPriceLine(info.price_php) : null;
    const payHref = `/courses/${slug}/pay`;
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 pt-8 pb-24">
        <Link href={`/courses/${slug}`} className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
          ← {catalog.title}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Para sa course owners ang capstone</h1>
        <p className="text-sm">Mabubuksan mo ang capstone self-check kapag na-unlock mo na ang {catalog.title}.</p>
        {price ? (
          <p className="text-sm text-muted-foreground" data-testid="capstone-price">
            {price}
          </p>
        ) : null}
        {info.state === "open" ? (
          <Link href={payHref} className={cn(buttonVariants({ variant: "default" }), "min-h-11 self-start")}>
            I-unlock ang course
          </Link>
        ) : info.state === "pending" ? (
          <div className="flex flex-col gap-2 text-sm">
            <div>
              <Chip tone="amber">Pending review</Chip>
            </div>
            <p>Ive-verify ni GFX within {APPROVAL_TIME}.</p>
            <Link href="/account" className="inline-flex min-h-11 items-center self-start underline">
              Tingnan ang status
            </Link>
          </div>
        ) : info.state === "rejected" ? (
          <Link href={payHref} className={cn(buttonVariants({ variant: "default" }), "min-h-11 self-start")}>
            Re-upload receipt
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Hindi pa bukas ang course na ito.</p>
        )}
        <ContentDisclaimerFooter />
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: cap }, { data: prog }] = await Promise.all([
    supabase.from("training_capstones").select("title, rubric, disclaimer").eq("course_id", info.course_id).maybeSingle(),
    supabase.from("capstone_progress").select("ticked").eq("course_id", info.course_id).maybeSingle(),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 pt-8 pb-24">
      <Link href={`/courses/${slug}`} className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
        ← {catalog.title}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{cap?.title ?? "Capstone"}</h1>
      {cap ? (
        <>
          <p className="text-sm">Self-check: i-tick ang bawat item kapag nagawa mo na. Gamitin ang cents o chart-replay.</p>
          <CapstoneChecklist courseId={info.course_id} items={(cap.rubric as string[]) ?? []} initial={(prog?.ticked as number[]) ?? []} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Inihahanda pa ang capstone. Balikan mo ito mamaya.</p>
      )}
      <ContentDisclaimerFooter disclaimer={cap?.disclaimer} />
    </div>
  );
}
