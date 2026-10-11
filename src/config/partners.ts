/**
 * Broker partner config. Add, remove or reorder partners here.
 * Only partners with `enabled: true` are shown anywhere on the site.
 *
 * Never add a claim about a broker (licensing, legal entity, spreads, etc.)
 * unless it has been verified. Until then leave the field null; the UI then
 * shows neutral "check the broker's licensing" text instead.
 */
export type Partner = {
  id: string;
  name: string;
  /** Legal entity the member contracts with (verified only; otherwise null). */
  entity: string | null;
  /** Verified licensing statement (otherwise null). */
  regulatorStatus: string | null;
  /** Demo account sign-up link (shown first when present). */
  demoUrl: string | null;
  /** IB/referral account link. */
  liveUrl: string | null;
  isIbAffiliate: boolean;
  enabled: boolean;
  /** Primary partner gets the featured slot on /broker. */
  featured?: boolean;
};

/**
 * Site-wide IB disclosure (compliance-baseline.md draft, 12 Oct 2026). Unverified
 * items from the draft (ACCM entity/regulator, PH SEC status) are deliberately
 * left out. Minimum deposit verified by Ben (Oct 2026). Never add a "no extra cost" claim (unverified).
 */
export const IB_DISCLOSURE_TEXT =
  "GFX's founder is an Introducing Broker (IB) for ACCM. If you open an ACCM account through our link or code bqqaoy, ACCM may pay us a commission or rebate, which under ACCM's IB program is usually based on trading volume. That means we earn more when referred clients trade more. That's why we teach demo first, max 1% risk, and never push over-trading. You don't have to use our link or any broker. The Academy is free. The ACCM link opens a live cents account registration (real money). Minimum deposit: $50 (as of Oct 2026), via GCash, Maya, or other e-wallets; check ACCM's site for current terms. Free demos are opened in the MT5 app. Check the broker's licensing for your country before opening an account. Trading involves real risk of loss.";

export const NEUTRAL_LICENSING_TEXT =
  "Check the broker's licensing for your country before opening an account.";

export const partners: Partner[] = [
  {
    id: "accm",
    name: "ACCM",
    entity: null,
    regulatorStatus: null,
    demoUrl: null,
    liveUrl:
      "https://accm.global/account/register?shareUserSetId=3a59d46d63f04393b&utm_source=gfx_site&utm_medium=broker_page&utm_campaign=gold_pilot_2026q4&utm_content=accm",
    isIbAffiliate: true,
    enabled: true,
    featured: true,
  },
  {
    // Hidden until the founder enables it (needs a referral link first).
    id: "vantage",
    name: "Vantage",
    entity: null,
    regulatorStatus: null,
    demoUrl: null,
    liveUrl: null,
    isIbAffiliate: true,
    enabled: false,
  },
];

/** Enabled partners that have a link to show. */
export const activePartners = () =>
  partners.filter((p) => p.enabled && (p.demoUrl ?? p.liveUrl));
