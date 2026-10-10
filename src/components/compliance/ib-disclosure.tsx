import { IB_DISCLOSURE_TEXT, NEUTRAL_LICENSING_TEXT, activePartners } from "@/config/partners";

/** Short disclosure — place next to every broker link or button. */
export function IbDisclosureShort() {
  return (
    <p className="text-xs text-muted-foreground">
      <strong>Disclosure:</strong> {IB_DISCLOSURE_TEXT}
    </p>
  );
}

/** Full disclosure for the /broker page (broker-neutral, no unverified claims). */
export function IbDisclosureFull() {
  const names = activePartners().map((p) => p.name).join(", ");
  return (
    <section
      aria-labelledby="ib-disclosure"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground"
    >
      <h2 id="ib-disclosure" className="text-sm font-semibold text-foreground">
        IB Disclosure
      </h2>
      <p>
        <strong>1. Our relationship.</strong> GFX Society&apos;s founder is an
        Introducing Broker (IB) affiliate{names ? ` of ${names}` : ""}. GFX is
        not a broker and does not hold client funds, execute trades, or manage
        accounts.
      </p>
      <p>
        <strong>2. How we get paid.</strong> {IB_DISCLOSURE_TEXT} The amount
        usually depends on how much you trade, which is why we teach demo first,
        a maximum of 1% risk per trade, and never encourage over-trading.
      </p>
      <p>
        <strong>3. Costs.</strong> Spreads, commissions and fees are set by the
        broker and vary by account type and market conditions. Check the
        broker&apos;s current pricing before you open an account.
      </p>
      <p>
        <strong>4. Broker status.</strong> GFX does not vouch for any
        broker&apos;s licensing, solvency, or execution quality.{" "}
        {NEUTRAL_LICENSING_TEXT}
      </p>
      <p>
        <strong>5. Your choice.</strong> You never need a broker account or our
        links to use GFX education or the community. You can use any broker you
        choose, or not trade at all.
      </p>
      <p>
        <strong>6. Data.</strong> We do not give your personal data to brokers
        unless you separately consent. Contact: goldfx.society@gmail.com
      </p>
    </section>
  );
}
