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

/** Approved neutral disclosure wording (same as the /broker hotfix, PR #12). */
export const IB_DISCLOSURE_TEXT =
  "GFX may earn a commission or rebate from partner brokers when you open an account or trade through our links. You can use any broker you choose.";

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
