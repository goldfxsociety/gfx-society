import { REFUND_COPY } from "@/config/training";

/** Addendum D1: plain text, 14px+, not hidden. */
export function RefundLine({ lang = "tl" }: { lang?: "tl" | "en" }) {
  return <p className="text-sm font-medium text-foreground">{REFUND_COPY[lang]}</p>;
}
