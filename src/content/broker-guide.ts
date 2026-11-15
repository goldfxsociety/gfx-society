/**
 * /broker and /en/broker copy (simplicity spec v2 §3, Appendix C + H). The PH risk box is byte-identical to main;
 * the EN risk box is Appendix H's meaning-identical English. The EN demo line is a direct translation of the existing
 * PH line that Appendix H does not list (approved by Design, PR #70 review, 15 Nov 2026).
 */
import { IB_DISCLOSURE_TEXT, IB_DISCLOSURE_TEXT_EN } from "@/config/partners";

type S = string;
export type BrokerCopy = {
  lang: "fil" | "en"; path: S; joinHref: S; title: S; description: S; eyebrow: S; h1: S; intro: S;
  riskTitle: S; riskBody: S; openCta: S; ib: S; realMoney: S; demo: S; back: S;
};

const TITLE = "Choosing a Broker";
const DESC = "Education-first broker info with IB disclosure. Start small, max 1% risk.";

export const BROKER_COPY: BrokerCopy = {
  lang: "fil",
  path: "/broker",
  joinHref: "/system/join",
  title: TITLE,
  description: DESC,
  eyebrow: "Broker",
  h1: "Start small when you're ready",
  intro: "GFX Academy is education-first. Hindi required ang broker account para sa lessons.",
  riskTitle: "Start small. Risk warning.",
  // Byte-identical to the /broker risk box on main (whitespace as rendered).
  riskBody:
    "Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss. Trading forex, gold and CFDs with leverage carries a high risk of losing money and is not suitable for everyone. Education only, not financial advice. Only trade with money you can afford to lose.",
  openCta: "Open ACCM Cents Account →",
  ib: IB_DISCLOSURE_TEXT,
  realMoney: "Real money, start small — max 1% risk per trade.",
  demo: "Optional: may free demo sa loob ng MT5 app kung gusto mo lang matutunan ang buttons (Buy, Sell, SL/TP, Close). Hindi ito required, at hindi nito tine-train ang emotions mo.",
  back: "← Back to home",
};

export const BROKER_COPY_EN: BrokerCopy = {
  lang: "en",
  path: "/en/broker",
  joinHref: "/en/system/join",
  title: TITLE,
  description: DESC,
  eyebrow: "Broker",
  h1: "Start small when you're ready",
  intro: "GFX Academy is education-first. A broker account is not required for the lessons.",
  riskTitle: "Start small. Risk warning.",
  // Appendix H, verbatim.
  riskBody:
    "If you trade, start small with a cents account: only money you can afford to lose. Max 1% risk per trade, always with a stop loss. Trading forex, gold and CFDs with leverage carries a high risk of losing money and is not suitable for everyone. Education only, not financial advice. Only trade with money you can afford to lose.",
  openCta: "Open ACCM Cents Account →",
  ib: IB_DISCLOSURE_TEXT_EN,
  realMoney: "Real money, start small — max 1% risk per trade.",
  demo: "Optional: there's a free demo inside the MT5 app if you just want to learn the buttons (Buy, Sell, SL/TP, Close). It isn't required, and it doesn't train your emotions.",
  back: "← Back to home",
};
