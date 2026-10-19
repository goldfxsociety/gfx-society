import type { Metadata } from "next";
import Link from "next/link";
import { AccmLink } from "@/components/partners/accm-link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { NEUTRAL_LICENSING_TEXT, activePartners } from "@/config/partners";
import { IbDisclosureFull, IbDisclosureShort } from "@/components/compliance/ib-disclosure";
import { DISCORD_INVITE_URL } from "@/config/journey";
import { DiscordApplyLink } from "@/components/funnel/discord-apply-link";

export const metadata: Metadata = {
  title: "Choosing a Broker",
  description: "Education-first broker info with IB disclosure. Start small, max 1% risk; you can use any broker.",
  alternates: { canonical: "/broker" },
  openGraph: { title: "Choosing a Broker", description: "Education-first broker info with IB disclosure. Start small, max 1% risk; you can use any broker.", url: "/broker", images: ["/opengraph-image"] },
};

export default function BrokerPage() {
  const list = activePartners();
  const featured = list.find((p) => p.featured) ?? list[0];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Broker
        </span>
        <h1 className="text-2xl font-bold tracking-tight">About ACCM</h1>
        <p className="text-sm text-muted-foreground">
          Education-first ang GFX Academy. Nandito ang page na ito kung ready ka nang mag-open ng account. Hindi ito required para magamit ang Academy.
        </p>
      </div>

      {featured && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-semibold">About {featured.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {featured.name} is the broker used in the Academy&apos;s examples.{" "}
            {featured.regulatorStatus ?? NEUTRAL_LICENSING_TEXT}
          </p>
        </div>
      )}

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <p className="font-semibold">Start small. Risk warning.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Kung magte-trade ka, start small sa cents account: pera lang na kaya mong mawala. Max 1% risk per trade, laging may stop loss.
          Trading forex, gold and CFDs with
          leverage carries a high risk of losing money and is not suitable for
          everyone. Education only, not financial advice. Only trade with money
          you can afford to lose.
        </p>
      </div>

      <IbDisclosureShort />

      {featured && (
        <div className="flex flex-col gap-2">
          <AccmLink
            href={featured.liveUrl!}
            className={cn(buttonVariants({ variant: "default" }), "h-12 w-full text-base")}
          >
            Open ACCM Cents Account →
          </AccmLink>
          <p className="text-sm text-muted-foreground">Real money, start small — max 1% risk per trade.</p>
          <p className="text-sm text-muted-foreground">
            Optional: may free demo sa loob ng MT5 app kung gusto mo lang matutunan ang buttons (Buy, Sell, SL/TP, Close). Hindi ito required, at hindi nito tine-train ang emotions mo.
          </p>
          {DISCORD_INVITE_URL && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">Step 2: Apply to join our Discord</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pagka-register mo sa ACCM, mag-apply sa Discord community namin. Ihanda ang ACCM User ID mo. Hihingin sa
                join application kung sino ang nag-invite sa&apos;yo, kung registered ka na, ang ACCM User ID mo, at
                pag-agree sa rules. Hindi namin hihingin ang password, OTP o ID documents mo.
              </p>
              <DiscordApplyLink page="broker" className={cn(buttonVariants({ variant: "outline" }), "mt-3 h-11 w-full")}>
                Apply to join our Discord →
              </DiscordApplyLink>
            </div>
          )}
        </div>
      )}

      <IbDisclosureFull />

      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
        ← Back to home
      </Link>
    </div>
  );
}
