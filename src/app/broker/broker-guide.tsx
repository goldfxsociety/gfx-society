import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { LanguageSwitch } from "@/components/academy/language-switch";
import { IbDisclosureFull, IbDisclosureShort } from "@/components/compliance/ib-disclosure";
import { AccmLink } from "@/components/partners/accm-link";
import { buttonVariants } from "@/components/ui/button";
import { NEUTRAL_LICENSING_TEXT, activePartners } from "@/config/partners";
import type { BrokerCopy } from "@/content/broker-guide";
import { JOIN_SYSTEM_CTA } from "@/content/access-request";
import { JOIN_COPY, JOIN_COPY_EN, SYSTEM_COPY, SYSTEM_UNDER_CTA_EN } from "@/content/members-gate";

export function brokerMetadata(c: BrokerCopy): Metadata {
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: c.path, languages: { en: "/en/broker", "fil-PH": "/broker", "x-default": "/broker" } },
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
 * /broker and /en/broker (simplicity spec v2). One gold CTA: Join the Trading System. The account button is outline
 * with IbDisclosureShort right under it; the risk box and IbDisclosureFull stay visible, not collapsed.
 * The Discord helper is dropped here (spec §3 "behind May problema? or dropped"); Discord stays on /accm.
 */
export function BrokerGuide({ c }: { c: BrokerCopy }) {
  const en = c.lang === "en";
  const list = activePartners();
  const featured = list.find((p) => p.featured) ?? list[0];
  const join = en ? JOIN_COPY_EN : JOIN_COPY;
  const underCta = en ? SYSTEM_UNDER_CTA_EN : SYSTEM_COPY.underCta;

  return (
    <div lang={c.lang} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pt-6 pb-12">
      <LanguageSwitch current={en ? "en" : "tl"} enHref="/en/broker" tlHref="/broker" location="broker" />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">{c.eyebrow}</span>
        <h1 className="text-2xl font-bold tracking-tight">{c.h1}</h1>
        <p className="text-sm text-muted-foreground">{c.intro}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{join.intro}</p>
        <p className="text-sm text-muted-foreground">{underCta}</p>
        {/* The page's only gold CTA (spec §6). */}
        <Link href={c.joinHref} className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          {JOIN_SYSTEM_CTA}
        </Link>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm" data-testid="broker-risk">
        <p className="font-semibold">{c.riskTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{c.riskBody}</p>
      </div>

      {featured && (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <p className="font-semibold">About {featured.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {featured.name} is the broker used in the Academy&apos;s examples.{" "}
              {featured.regulatorStatus ?? NEUTRAL_LICENSING_TEXT}
            </p>
          </div>
          <AccmLink href={featured.liveUrl!} className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full text-base")}>
            {c.openCta}
          </AccmLink>
          <IbDisclosureShort text={c.ib} />
          <p className="text-sm text-muted-foreground">{c.realMoney}</p>
          <p className="text-sm text-muted-foreground">{c.demo}</p>
        </div>
      )}

      <IbDisclosureFull />

      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
        {c.back}
      </Link>
    </div>
  );
}
