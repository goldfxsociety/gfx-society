import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import { NextStepLink } from "@/components/funnel/next-step-link";

export const metadata: Metadata = {
  title: "Community",
  description: "Paano sumali sa GFX Society Discord community: aral muna sa libreng Academy, then ang next steps. Start small, max 1% risk, laging may stop loss.",
  alternates: { canonical: "/community" },
  openGraph: { title: "Community", description: "Paano sumali sa GFX Society Discord community: aral muna sa libreng Academy, then ang next steps. Start small, max 1% risk, laging may stop loss.", url: "/community", images: ["/opengraph-image"] },
};


export default function CommunityPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Community
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Ang GFX community</h1>
        <p className="text-sm text-muted-foreground">
          Ang Discord community namin ay para sa mga nag-register sa ACCM through our link. Hindi ka pa ready? Okay lang &apos;yan. Libre ang Academy, at puwede kang bumalik dito kahit kailan.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-semibold">Ganito ang steps</p>
        <ol className="mt-2 flex flex-col gap-1 text-muted-foreground">
          <li>1. Tapusin ang basics sa Academy (libre).</li>
          <li>2. Kapag ready ka na, mag-register sa ACCM: start small sa cents account, max 1% risk, laging may stop loss.</li>
          <li>3. Mag-apply sa Discord community namin.</li>
        </ol>
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
        <NextStepLink
          location="community"
          className={cn(buttonVariants({ variant: "default" }), "h-auto min-h-11 whitespace-normal py-2 text-center")}
        >
          Next step: guided training sa partner community namin →
        </NextStepLink>
        <Link href="/academy" className={`${buttonVariants({ variant: "outline" })} min-h-11`}>
          Bumalik sa Academy
        </Link>
        <p className="text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
      </div>

      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
        ← Back to home
      </Link>
    </div>
  );
}
