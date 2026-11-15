import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { RiskFooter } from "@/components/academy/risk-footer";
import { LanguageSwitch } from "@/components/academy/language-switch";
import { DiscordApplyLink } from "@/components/funnel/discord-apply-link";
import { Expander } from "@/components/layout/expander";
import { buttonVariants } from "@/components/ui/button";
import { DISCORD_INVITE_URL, accmHref } from "@/config/journey";
import type { AccmCopy } from "@/content/accm-guide";
import { JOIN_SYSTEM_CTA } from "@/content/access-request";
import { JOIN_COPY, JOIN_COPY_EN, SYSTEM_COPY, SYSTEM_UNDER_CTA_EN } from "@/content/members-gate";
import { AccmSelfCheck, CodeChip } from "./accm-self-check";

/** Shared metadata: no ACCM in title/og (spec §3); hreflang pair as on /en/academy/gold-starter. */
export function accmMetadata(c: AccmCopy): Metadata {
  return {
    title: c.title,
    description: c.description,
    robots: { index: false, follow: true },
    alternates: { canonical: c.path, languages: { en: "/en/accm", "fil-PH": "/accm", "x-default": "/accm" } },
    openGraph: {
      title: c.title,
      description: c.description,
      url: c.path,
      images: ["/opengraph-image"],
      ...(c.lang === "en" ? { locale: "en" } : {}),
    },
    twitter: { card: "summary_large_image", title: c.title, description: c.description },
  };
}

/**
 * /accm and /en/accm (simplicity spec v2): same layout, copy swapped. One gold CTA (Join the Trading System);
 * the self-check, invitation code, "Open cents account →" and the IB line stay visible; the short risk line is
 * visible and the long risk text sits in the "Risk warning" expander (Ben, decision 4). Discord is under help.
 */
export function AccmGuide({ c }: { c: AccmCopy }) {
  const en = c.lang === "en";
  const lang = en ? "en" : "tl";
  const join = en ? JOIN_COPY_EN : JOIN_COPY;
  const underCta = en ? SYSTEM_UNDER_CTA_EN : SYSTEM_COPY.underCta;
  return (
    <div lang={c.lang} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pt-6 pb-20">
      {/* One <header>: the language switch links to /accm, so the partner line sits in the same block. */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link href={c.academyHref} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
            {c.back}
          </Link>
          <LanguageSwitch current={lang} enHref="/en/accm" tlHref="/accm" location="accm" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">{c.eyebrow}</span>
          <h1 className="text-2xl font-bold tracking-tight">{c.h1}</h1>
          <p className="text-sm text-muted-foreground">{c.intro}</p>
          <p className="text-xs text-muted-foreground" data-testid="ib-line">{c.ib}</p>
        </div>
      </header>
      <RiskFooter compact={lang} />

      <section aria-labelledby="accm-s1" className="flex flex-col gap-2">
        <h2 id="accm-s1" className="text-lg font-semibold">{c.s1}</h2>
        <AccmSelfCheck href={accmHref("accm_page")} disclosure={c.ib} lang={lang} />
        <Link href={c.academyHref} className="inline-flex min-h-11 items-center self-start text-sm underline">
          {c.notReady}
        </Link>
      </section>

      <section aria-labelledby="accm-s2" className="flex flex-col gap-2">
        <h2 id="accm-s2" className="text-lg font-semibold">{c.s2}</h2>
        <ol className="flex flex-col gap-3 text-sm">
          <li>{c.steps.open}</li>
          <li className="flex flex-wrap items-center gap-2">
            {c.steps.code} <CodeChip lang={lang} />
          </li>
          <li>{c.steps.verify}</li>
          <li>
            {c.steps.kyc}
            <span className="block text-muted-foreground">{c.steps.kycNote}</span>
          </li>
        </ol>
      </section>

      <section aria-labelledby="accm-s3" className="flex flex-col gap-2">
        <h2 id="accm-s3" className="text-lg font-semibold">{c.s3}</h2>
        <p className="text-sm text-muted-foreground">{join.intro}</p>
        <p className="text-sm text-muted-foreground">{underCta}</p>
        {/* The page's only gold CTA (spec §6). */}
        <Link href={c.joinHref} className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          {JOIN_SYSTEM_CTA}
        </Link>
        <Expander summary={c.help} testId="help">
          {DISCORD_INVITE_URL ? (
            <>
              <DiscordApplyLink page="accm" lang={lang} className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
                {c.discordCta}
              </DiscordApplyLink>
              <p>{c.discordPrep}</p>
              <p className="text-xs">{c.discordNote}</p>
            </>
          ) : (
            <p>{c.discordSoon}</p>
          )}
        </Expander>
      </section>

      <section aria-labelledby="accm-s4" className="flex flex-col gap-1">
        <h2 id="accm-s4" className="text-lg font-semibold">{c.s4}</h2>
        {c.faq.map((f) => (
          <details key={f.q} className="rounded-md border border-border px-3">
            <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">{f.q}</summary>
            <p className="pb-3 text-sm text-muted-foreground">
              {f.a}
              {f.ib ? (
                <>
                  {" "}
                  <span className="text-xs">{c.ib}</span>
                </>
              ) : null}
            </p>
          </details>
        ))}
      </section>
    </div>
  );
}
