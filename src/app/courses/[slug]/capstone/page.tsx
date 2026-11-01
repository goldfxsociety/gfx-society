import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findCatalog, getPaymentInfo } from "@/lib/training/courses";
import { getMembership } from "@/lib/training/gate";
import { ContentDisclaimerFooter } from "@/components/training/content-disclaimer-footer";
import { CapstoneChecklist } from "./capstone-checklist";

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
