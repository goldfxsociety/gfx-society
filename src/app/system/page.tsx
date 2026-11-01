import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { SYSTEM_COPY as C } from "@/content/members-gate";
import { MEMBERS_IB_DISCLOSURE_TEXT } from "@/config/partners";

export const metadata: Metadata = { title: "GFX Trading System | GFX Society" };

// Minimal neutral layout; final UX needs Design (proposal v5 §1 /system).
export default function SystemPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      <p className="leading-relaxed">{C.intro}</p>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{C.whoTitle}</h2>
        <p className="text-sm leading-relaxed">{C.who}</p>
        <p className="text-xs text-muted-foreground">{MEMBERS_IB_DISCLOSURE_TEXT}</p>
      </section>
      <Link href="/system/join" className={cn(buttonVariants({ variant: "default" }), "h-11 w-full sm:w-auto")}>
        {C.joinCta}
      </Link>
      <p className="text-xs text-muted-foreground">{C.risk}</p>
    </div>
  );
}
