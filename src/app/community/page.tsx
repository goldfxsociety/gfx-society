import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import { RISK_LINE } from "@/config/training";
import { JOIN_SYSTEM_CTA } from "@/content/access-request";
import { MEMBERS_ONLY_HINT } from "@/content/members-gate";

const DESC =
  "Ang GFX community: aral muna sa libreng Academy, then join the Trading System. Start small, max 1% risk, laging may stop loss.";

export const metadata: Metadata = {
  title: "Community",
  description: DESC,
  alternates: { canonical: "/community" },
  openGraph: { title: "Community", description: DESC, url: "/community", images: ["/opengraph-image"] },
};


// Simplicity spec v2 (Ben, decision 1): gold = Join the Trading System; Academy is outline. No Discord-first step.
export default function CommunityPage() {
  return (
    <div lang="fil" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Community
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Ang GFX community</h1>
        <p className="text-sm text-muted-foreground">
          Join the Trading System after you learn the basics. Libre pa rin ang Academy.
        </p>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
        <p className="font-semibold">Community guidelines</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Be respectful, no spam, at bawal magbenta ng trade calls, paid groups o guaranteed-profit
          schemes. This is an education space — trading involves risk, and no
          one here can promise you a result.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {/* QA P3-6: members-only before the Join click. */}
        <p className="text-xs text-muted-foreground" data-testid="members-only-hint">{MEMBERS_ONLY_HINT}</p>
        <Link href="/system/join" className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          {JOIN_SYSTEM_CTA}
        </Link>
        <Link href="/academy" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
          Bumalik sa Academy
        </Link>
        <p className="text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
        <p className="text-xs text-muted-foreground" data-testid="risk-line">{RISK_LINE}</p>
      </div>

      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
        ← Back to home
      </Link>
    </div>
  );
}
