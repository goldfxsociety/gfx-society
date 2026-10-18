import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { GO_NEXT_STEP_HREF, resolveGoCode } from "@/lib/links/go-codes";
import { NextStepLink } from "@/components/funnel/next-step-link";
import { GoRedirect } from "./go-redirect";

export const metadata: Metadata = {
  title: "GFX Society",
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
      <h1 className="text-xl font-bold">Welcome to GFX Society</h1>
      <p className="text-sm text-muted-foreground">
        Free gold trading education. Taking you to the Academy…
      </p>
      <Link href={target.href} className={`${buttonVariants({ variant: "default" })} min-h-11`}>
        Start learning →
      </Link>
      {GO_NEXT_STEP_HREF && (
        <NextStepLink
          location="go"
          className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 whitespace-normal py-2 text-center")}
        >
          Next step: guided training sa partner community namin
        </NextStepLink>
      )}
      <p className="text-xs text-muted-foreground">
        Education only, not financial advice. Real risk of loss. Start small, max 1% risk, laging may stop loss.
      </p>
      <GoRedirect href={target.href} />
    </div>
  );
}
