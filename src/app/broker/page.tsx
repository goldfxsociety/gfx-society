import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function BrokerPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Broker
        </span>
        <h1 className="text-2xl font-bold tracking-tight">About ACCM</h1>
        <p className="text-sm text-muted-foreground">
          GFX Academy is education-first — this page is here if and when you&apos;re
          ready to open an account, not a requirement to use the Academy.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-semibold">About ACCM</p>
        <p className="mt-1 text-xs text-muted-foreground">
          ACCM is the broker used in the Academy&apos;s examples. Before opening
          any account, check the broker&apos;s licence and terms yourself.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <p className="font-semibold">Demo first. Risk warning.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Start on a free demo account and follow your plan: max 1% risk per
          trade, stop-loss on every trade. Trading forex, gold and CFDs with
          leverage carries a high risk of losing money and is not suitable for
          everyone. Education only, not financial advice. Only trade with money
          you can afford to lose.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Disclosure:</strong> GFX may earn a commission or rebate from
        partner brokers when you open an account or trade through our links.
        You can use any broker you choose.
      </p>

      <a
        href="https://accm.global/account/register?shareUserSetId=3a59d46d63f04393b"
        target="_blank"
        rel="sponsored noopener noreferrer"
        className={buttonVariants({ variant: "default" })}
      >
        Open Free Demo Account →
      </a>

      <Link href="/" className="text-sm text-muted-foreground underline">
        ← Back to home
      </Link>
    </div>
  );
}
