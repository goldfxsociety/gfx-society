import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BUY_ENABLED, STATUS_SURFACE_NOTE } from "@/config/training";
import { findCatalog, getPaymentInfo } from "@/lib/training/courses";
import { requireMember } from "@/lib/training/gate";
import { createClient } from "@/lib/supabase/server";
import { MembersFooter } from "@/components/training/members-footer";
import { PayForm } from "./pay-form";

export const metadata: Metadata = { title: "Bayaran ang course | GFX", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = findCatalog(slug);
  if (!catalog) notFound();
  await requireMember(`/courses/${slug}/pay`);
  const info = await getPaymentInfo(slug);
  // Server-side gate (B-AC2, B11, B12): only "open" or "rejected" reach the form.
  if (info.state === "pending" || info.state === "approved") redirect("/account");
  if (!BUY_ENABLED || (info.state !== "open" && info.state !== "rejected")) redirect(`/courses/${slug}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/courses/${slug}/pay`);

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 pt-8 pb-24">
      <Link href={`/courses/${slug}`} className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
        ← {catalog.title}
      </Link>
      <PayForm
        slug={slug}
        userId={user.id}
        title={catalog.title}
        price={info.price_php ?? 0}
        paymentCode={info.payment_code ?? ""}
        rejectReason={info.state === "rejected" ? (info.reject_reason ?? null) : null}
        holderName={process.env.GCASH_ACCOUNT_NAME ?? ""}
        gcashNumber={process.env.GCASH_NUMBER ?? ""}
      />
      <p className="text-sm text-muted-foreground">{STATUS_SURFACE_NOTE}</p>
      <MembersFooter />
    </div>
  );
}
