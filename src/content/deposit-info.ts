/**
 * In-app deposit facts (explorer-linked-tiers-spec v1.1 §2.3, §3). Moved OFF the public /accm and /en/accm pages.
 * Shown only signed in: on /system/join under "May problema?" (Explorer / pending) and on /account for Linked.
 * Funding is education only; it is NOT part of the Linked gate. Not gold, no IB line inside the expander.
 * The spec body ends with the risk + NFA sentence; it is dropped here because every page that renders this already
 * shows the risk line once in its footer (one risk line + one NFA per page). The rest is the spec text verbatim.
 */
export const DEPOSIT_INFO = {
  tl: {
    title: "Paano mag-deposit",
    body: "Kapag ready ka na, puwede kang mag-deposit sa cents account mo. Minimum sa broker na ito: $50, via GCash, Maya, o ibang e-wallets. Pera lang na kaya mong mawala. Hindi mo kailangang lampasan ang minimum. Laging may stop loss.",
  },
  en: {
    title: "How to fund",
    body: "When you're ready, you can fund your cents account. This broker's minimum is $50, via GCash, Maya, or other e-wallets. Only money you can afford to lose. You don't have to deposit more than the minimum. Always with a stop loss.",
  },
} as const;
