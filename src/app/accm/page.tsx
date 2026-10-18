import type { Metadata } from "next";
import Link from "next/link";
import { RiskFooter } from "@/components/academy/risk-footer";
import { IB_DISCLOSURE_TEXT, NEUTRAL_LICENSING_TEXT } from "@/config/partners";
import { DISCORD_INVITE_URL, accmHref } from "@/config/journey";
import { DiscordApplyLink } from "@/components/funnel/discord-apply-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { AccmSelfCheck, CodeChip } from "./accm-self-check";

export const revalidate = 3600;

const DESC = "Step-by-step guide: start small sa cents account, max 1% risk, laging may stop loss. Education only.";
export const metadata: Metadata = {
  title: "ACCM account guide",
  description: DESC,
  robots: { index: false, follow: true },
  alternates: { canonical: "/accm" },
  openGraph: { title: "ACCM account guide", description: DESC, url: "/accm", images: ["/opengraph-image"] },
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "Kailangan ko ba ng ACCM account para sa Academy?", a: "Hindi. Libre ang Academy, kahit anong broker o kahit wala pa." },
  {
    q: "Bakit ACCM para sa Discord community?",
    a: (
      <>
        Ang Discord community namin ay para sa mga nag-register sa ACCM through our link.{" "}
        <span className="text-xs">{IB_DISCLOSURE_TEXT}</span>
      </>
    ),
  },
  {
    q: "Magkano ang minimum deposit?",
    a: "$50, via GCash, Maya o ibang e-wallets. Pera lang na kaya mong mawala. Hindi mo kailangang lampasan ang minimum.",
  },
  { q: "Licensed ba ang ACCM?", a: NEUTRAL_LICENSING_TEXT },
  {
    q: "Ano ang cents account?",
    a: "Real-money account na naka-cents ang balance, kaya maliit ang taya habang natututo ka. Real pa rin ang losses.",
  },
  {
    q: "Kailangan ko ba ng demo?",
    a: "Hindi required. Optional ang free demo sa loob ng MT5 app kung gusto mo lang matutunan ang buttons.",
  },
  // "Paano mag-withdraw?" is hidden until Ben confirms the withdrawal info.
  { q: "Guaranteed ba kikita?", a: "Hindi. Maraming traders ang natatalo. Start small, max 1% risk, laging may stop loss." },
];

export default function AccmPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pt-6 pb-20">
      <Link href="/academy" className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
        ← Back to Academy
      </Link>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">ACCM account guide</span>
        <h1 className="text-2xl font-bold tracking-tight">Paano mag-register sa ACCM, step by step</h1>
        <p className="text-sm text-muted-foreground">Para ito sa ready nang mag-start small with real money.</p>
        <p className="text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
      </div>
      <RiskFooter />

      <section aria-labelledby="accm-s1" className="flex flex-col gap-2">
        <h2 id="accm-s1" className="text-lg font-semibold">1. Quick self-check</h2>
        <AccmSelfCheck href={accmHref("accm_page")} disclosure={IB_DISCLOSURE_TEXT} />
        <Link href="/academy" className="inline-flex min-h-11 items-center self-start text-sm underline">
          Hindi pa ready? Balik sa lessons →
        </Link>
      </section>

      <section aria-labelledby="accm-s2" className="flex flex-col gap-2">
        <h2 id="accm-s2" className="text-lg font-semibold">2. Registration steps</h2>
        <ol className="flex flex-col gap-3 text-sm">
          <li>① Tap &quot;Open cents account&quot;. Bubukas ang ACCM site sa cents signup.</li>
          <li className="flex flex-wrap items-center gap-2">
            ② Invitation code: <CodeChip />
          </li>
          <li>③ I-verify ang email o phone mo.</li>
          <li>
            ④ KYC: Sundan ang KYC steps sa ACCM site.
            <span className="block text-muted-foreground">Sa ACCM lang ang ID mo; hindi ito nakikita ng GFX.</span>
          </li>
        </ol>
      </section>

      <section aria-labelledby="accm-s3" className="flex flex-col gap-2">
        <h2 id="accm-s3" className="text-lg font-semibold">3. Pagka-register: apply to Discord</h2>
        {DISCORD_INVITE_URL ? (
          <>
            <p className="text-sm text-muted-foreground">
              Ihanda ang ACCM User ID mo. Hihingin sa join application: sino ang nag-invite sa&apos;yo, kung registered ka
              na, ang ACCM User ID mo, at pag-agree sa rules. Hindi namin hihingin ang password, OTP o ID documents mo.
            </p>
            <DiscordApplyLink page="accm" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
              Apply to join our Discord →
            </DiscordApplyLink>
            <p className="text-xs text-muted-foreground">
              Sa Discord: guided training para sa beginners. Mag-deposit lang pagkatapos ng training, small: min $50, pera
              na kaya mong mawala.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Discord: coming soon.</p>
        )}
      </section>

      <section aria-labelledby="accm-s4" className="flex flex-col gap-1">
        <h2 id="accm-s4" className="text-lg font-semibold">4. FAQ</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="rounded-md border border-border px-3">
            <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">{f.q}</summary>
            <p className="pb-3 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
