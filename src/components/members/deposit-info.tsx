import { DEPOSIT_INFO } from "@/content/deposit-info";

/** Muted native <details> with the in-app deposit facts (spec §2.3). Not gold; no IB line inside. */
export function DepositInfo({ lang = "tl" }: { lang?: "tl" | "en" }) {
  const D = DEPOSIT_INFO[lang];
  return (
    <details data-testid="deposit-info" className="group rounded-md border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm [&::-webkit-details-marker]:hidden">
        {D.title}
        <span aria-hidden className="text-muted-foreground group-open:rotate-90">
          ▸
        </span>
      </summary>
      <p className="px-3 pb-3 text-sm leading-relaxed text-muted-foreground">{D.body}</p>
    </details>
  );
}
