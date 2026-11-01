import type { Metadata } from "next";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { SYSTEM_COPY as C } from "@/content/members-gate";

export const metadata: Metadata = { title: "GFX Trading System" };

// Copy: GFX Design Addendum A. No IB/commission line in the members area (Design D3). Layout: Design.
export default function SystemPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      <p className="leading-relaxed">{C.intro}</p>
      <ul className="flex flex-col gap-3">
        {C.rows.map((r) => (
          <li key={r.title} className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{r.title}</h2>
            <p className="text-sm leading-relaxed">{r.body}</p>
          </li>
        ))}
      </ul>
      <Link href="/system/join" className={cn(buttonVariants({ variant: "default" }), "h-11 w-full sm:w-auto")}>
        {C.joinCta}
      </Link>
      <p className="text-sm text-muted-foreground">{C.underCta}</p>
      <p className="text-xs text-muted-foreground">{C.risk}</p>
      {/* Partner line (Ben, P2-C): public pages that mention ACCM. Shows "Partner broker ng GFX ang ACCM." once #54 lands. */}
      <p className="text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
    </div>
  );
}
