/**
 * Risk + start-small footer for every Academy level and lesson page.
 * Self-contained: the full risk warning is in-page (#risk-warning), so there is
 * no dependency on the /risk route (added in PR #3).
 */
export function RiskFooter() {
  return (
    <aside
      id="risk-warning"
      aria-label="Risk warning"
      className="mt-4 scroll-mt-20 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed"
    >
      <p>
        <strong>Start small.</strong> Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.
      </p>
      <p className="mt-1 text-muted-foreground">
        Education only, not financial advice. Education lang, hindi financial advice, at walang profit promises.
      </p>
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium underline">
          Risk warning
        </summary>
        <p className="mt-1 text-muted-foreground">
          GFX Society provides trading education only — not financial advice. Trading forex, gold (XAUUSD) and CFDs with leverage carries a high risk of losing money quickly, and it is not suitable for everyone. Past results, on any account, do not guarantee future results. If you trade, start small (for example, a cents account), risk max 1% per trade with a stop-loss on every trade, and never trade money you cannot afford to lose.
        </p>
      </details>
    </aside>
  );
}
