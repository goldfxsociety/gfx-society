import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function BrokerPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          Broker
        </span>
        <h1 className="text-2xl font-bold tracking-tight">About ACCM</h1>
        <p className="text-sm text-zinc-500">
          GFX Academy is education-first — this page is here if and when you&apos;re
          ready to open an account, not a requirement to use the Academy.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p className="font-semibold">Why ACCM</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          ACCM is a regulated broker offering competitive Gold spreads, fast
          MT5 execution, and support across Southeast Asia — the broker used
          throughout the Academy&apos;s examples.
        </p>
      </div>

      <a
        href="https://www.wikifx.com/fil/dealer/3052942299.html"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 transition-colors hover:border-amber-400 dark:border-zinc-800"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-white">
          W
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">ACCM — Verified on WikiFX</p>
          <p className="text-xs text-zinc-500">
            Independent broker verification platform
          </p>
        </div>
        <span className="text-xs font-medium text-emerald-600">Verified ✓</span>
      </a>

      <a
        href="https://accm.global/account/register?shareUserSetId=3a59d46d63f04393b"
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "default" })}
      >
        Open Free Demo Account →
      </a>

      <p className="text-xs text-zinc-400">
        Affiliated link. Trading involves risk — past performance is not
        indicative of future results. Only trade with money you can afford to
        lose.
      </p>

      <Link href="/" className="text-sm text-zinc-500 underline">
        ← Back to home
      </Link>
    </div>
  );
}
