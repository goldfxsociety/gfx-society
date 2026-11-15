import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { resolveGoCode } from "@/lib/links/go-codes";
import { RISK_LINE } from "@/config/training";
import { JOIN_SYSTEM_CTA } from "@/content/access-request";
import { NextStepLink } from "@/components/funnel/next-step-link";
import { GoRedirect } from "./go-redirect";

export const metadata: Metadata = {
  title: { absolute: "GFX Society" },
  robots: { index: false, follow: false },
};

/**
 * Interstitial (not a server 302) so Vercel Web Analytics counts a page view at /go/<code>.
 * Clicks are counted, not community joins.
 */
export default async function GoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const target = resolveGoCode(code);
  if (!target) notFound();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Welcome to GFX Society</h1>
      <p className="text-sm text-muted-foreground">
        Free gold trading education. Taking you to the Academy…
      </p>
      <Link href={target.href} className={`${buttonVariants({ variant: "default" })} min-h-11`}>
        Start learning →
      </Link>
      {/* Simplicity spec v2: the one next step is Join the Trading System (outline here; gold stays "Start learning →"). */}
      {/* QA P3-8: same next_step_click event (location "go") the old next-step button logged. */}
      <NextStepLink
        location="go"
        href="/system/join"
        className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 whitespace-normal py-2 text-center")}
      >
        {JOIN_SYSTEM_CTA}
      </NextStepLink>
      <p className="text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
      <p className="text-xs text-muted-foreground" data-testid="risk-line">{RISK_LINE}</p>
      <p className="text-xs text-muted-foreground">
        Real risk of loss. Start small, laging may stop loss.
      </p>
      <GoRedirect href={target.href} />
    </div>
  );
}
