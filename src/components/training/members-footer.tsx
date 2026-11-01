import Link from "next/link";
import { RISK_LINE, RISK_LINK_TEXT } from "@/config/training";

/** Members-area footer: risk line only. No IB/commission line in the members area (Addendum D3). */
export function MembersFooter() {
  return (
    <footer className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm text-muted-foreground">
      <p>{RISK_LINE}</p>
      <Link href="/risk" className="inline-flex min-h-11 items-center self-start underline">
        {RISK_LINK_TEXT}
      </Link>
    </footer>
  );
}
