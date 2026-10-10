/**
 * Risk + demo-first footer for every Academy level and lesson page.
 * Self-contained: the full risk warning is in-page (#risk-warning), so there is
 * no dependency on the /risk route (added in PR #3).
 */
export function RiskFooter() {
  return (
    <aside
      id="risk-warning"
      aria-label="Risk warning"
      className="mt-4 scroll-mt-20 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs leading-relaxed"
    >
      <p>
        <strong>Demo first.</strong> Practise on a free demo account and follow
        your plan: max 1% risk per trade, stop-loss on every trade.
      </p>
      <p className="mt-1 text-muted-foreground">
        Education only, not financial advice. Education lang, hindi financial
        advice. Demo muna.
      </p>
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium underline">
          Risk warning
        </summary>
        <p className="mt-1 text-muted-foreground">
          GFX Society provides trading education only — not financial advice.
          Trading forex, gold (XAUUSD) and CFDs with leverage carries a high
          risk of losing money quickly, and it is not suitable for everyone.
          Past or demo results do not guarantee future results. Practise on a
          demo account first and never trade money you cannot afford to lose.
        </p>
      </details>
    </aside>
  );
}
