import type { Metadata } from "next";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Expander } from "@/components/layout/expander";
import { cn } from "cn";
import { JOIN_SYSTEM_CTA } from "@/content/access-request";
import { SYSTEM_COPY as C, SYSTEM_ROWS_SUMMARY } from "@/content/members-gate";

export const metadata: Metadata = { title: "GFX Trading System" };

// Copy: GFX Design Addendum A. Compact per simplicity spec v2 P2.6: heading, one line, the one gold Join, then the
// members-only line, RISK_LINE and the partner line (the page mentions ACCM). The three rows sit in one <details>.
export default function SystemPage() {
  return (
    <div lang="fil" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{C.intro}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Link href="/system/join" className={cn(buttonVariants({ variant: "default" }), "h-11 w-full sm:w-auto")}>
          {JOIN_SYSTEM_CTA}
        </Link>
        <p className="text-sm text-muted-foreground">{C.underCta}</p>
      </div>
      <Expander summary={SYSTEM_ROWS_SUMMARY} testId="system-rows">
        <ul className="flex flex-col gap-3">
          {C.rows.map((r) => (
            <li key={r.title} className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">{r.title}</h2>
              <p className="text-sm leading-relaxed">{r.body}</p>
            </li>
          ))}
        </ul>
      </Expander>
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground" data-testid="risk-line">{C.risk}</p>
        {/* Partner line (Ben, P2-C): public pages that mention ACCM. */}
        <p className="text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
      </div>
    </div>
  );
}
