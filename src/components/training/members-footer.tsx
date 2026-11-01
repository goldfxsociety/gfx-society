import Link from "next/link";
import { RISK_LINE, RISK_LINK_TEXT } from "@/config/training";

/**
 * Members-area footer: risk line + /risk link. No IB/commission line in the members area (Addendum D3).
 * hideRiskLine: set when the page already shows a content disclaimer (see ContentDisclaimerFooter),
 * so each risk sentence appears once per page. The /risk link always stays.
 */
export function MembersFooter({ hideRiskLine = false }: { hideRiskLine?: boolean }) {
  return (
    <footer className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm text-muted-foreground">
      {hideRiskLine ? null : <p>{RISK_LINE}</p>}
      <Link href="/risk" className="inline-flex min-h-11 items-center self-start underline">
        {RISK_LINK_TEXT}
      </Link>
    </footer>
  );
}
