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
  /** IB/referral account link. */
  liveUrl: string | null;
  isIbAffiliate: boolean;
  enabled: boolean;
  /** Primary partner gets the featured slot on /broker. */
  featured?: boolean;
};

/**
 * Short partner-broker line for public pages with an ACCM link or sign-up
 * (Ben-approved 2 Nov 2026, via Jarvis; Design Addendum D, D3).
 */
export const IB_DISCLOSURE_TEXT = "Partner broker ng GFX ang ACCM.";
// EN variant ("ACCM is GFX's partner broker.") is added when an /en page links to ACCM.

/**
 * The single full explanation of the commission, used only in /broker
 * "2. How we get paid" (Ben, 2 Nov 2026). Everywhere else uses IB_DISCLOSURE_TEXT.
 */
export const IB_LONGFORM_PAYMENT_TEXT =
  "GFX may earn a commission from ACCM if you sign up through our link.";

export const NEUTRAL_LICENSING_TEXT =
  "Check the broker's licensing for your country before opening an account.";

export const partners: Partner[] = [
  {
    id: "accm",
    name: "ACCM",
    entity: null,
    regulatorStatus: null,
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
    liveUrl: null,
    isIbAffiliate: true,
    enabled: false,
  },
];

/** Enabled partners that have a link to show. */
export const activePartners = () =>
  partners.filter((p) => p.enabled && p.liveUrl);
