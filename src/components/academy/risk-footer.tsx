import Link from "next/link";

/** Risk + demo-first footer for every Academy level and lesson page. */
export function RiskFooter() {
  return (
    <aside
      aria-label="Risk warning"
      className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs leading-relaxed"
    >
      <p>
        <strong>Demo first.</strong> Practise on a free demo account and follow
        your plan: max 1% risk per trade, stop-loss on every trade.
      </p>
      <p className="mt-1 text-muted-foreground">
        Education only, not financial advice. Trading gold (XAUUSD), forex and
        CFDs with leverage carries a high risk of losing money quickly. Never
        trade money you can&apos;t afford to lose.{" "}
        <Link href="/risk" className="underline">
          Risk warning
        </Link>
      </p>
      <p className="mt-1 text-muted-foreground">
        Education lang, hindi financial advice. Demo muna.
      </p>
    </aside>
  );
}
