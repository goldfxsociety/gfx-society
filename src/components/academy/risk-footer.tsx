import { RISK_LINE, RISK_LINE_EN_SHORT } from "@/config/training";

/** RiskFooter wording, one source (tests compare these byte for byte). */
export const RISK_START_SMALL =
  "Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.";
export const RISK_EDU_LINE = "Education only, not financial advice. Education lang, hindi financial advice, at walang profit promises.";
export const RISK_WARNING_LONG =
  "GFX Society provides trading education only — not financial advice. Trading forex, gold (XAUUSD) and CFDs with leverage carries a high risk of losing money quickly, and it is not suitable for everyone. Past results, on any account, do not guarantee future results. If you trade, start small (for example, a cents account), risk max 1% per trade with a stop-loss on every trade, and never trade money you cannot afford to lose.";

/**
 * Risk + start-small footer for every Academy level and lesson page.
 * Self-contained: the full risk warning is in-page (#risk-warning), so there is
 * no dependency on the /risk route (added in PR #3).
 *
 * `compact` (/accm "tl", /en/accm "en"; simplicity spec v2, Ben's decision 4): only the short risk line is visible;
 * the longer paragraphs move, unchanged, into the same "Risk warning" expander. EN keeps only the English long text.
 */
export function RiskFooter({ compact }: { compact?: "tl" | "en" } = {}) {
  const long = (
    <p className="mt-1 text-muted-foreground">
      {RISK_WARNING_LONG}
    </p>
  );
  if (compact) {
    return (
      <aside
        id="risk-warning"
        aria-label="Risk warning"
        className="scroll-mt-20 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs leading-relaxed"
      >
        <p data-testid="risk-line">{compact === "en" ? RISK_LINE_EN_SHORT : RISK_LINE}</p>
        <details className="mt-2" data-testid="risk-details">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium underline">Risk warning</summary>
          {compact === "tl" && (
            <>
              <p className="mt-1">
                <strong>Start small.</strong> {RISK_START_SMALL}
              </p>
              <p className="mt-1 text-muted-foreground">{RISK_EDU_LINE}</p>
            </>
          )}
          {long}
        </details>
      </aside>
    );
  }
  return (
    <aside
      id="risk-warning"
      aria-label="Risk warning"
      className="mt-4 scroll-mt-20 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs leading-relaxed"
    >
      <p>
        <strong>Start small.</strong> {RISK_START_SMALL}
      </p>
      <p className="mt-1 text-muted-foreground">
        {RISK_EDU_LINE}
      </p>
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium underline">
          Risk warning
        </summary>
        {long}
      </details>
    </aside>
  );
}
