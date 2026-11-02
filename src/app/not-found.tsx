import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getMembership } from "@/lib/members/membership";
import { cn } from "cn";

export default async function NotFound() {
  // E8.1: members (active/grace) go back to Training; everyone else to the Academy.
  let isMember = false;
  try {
    const { membership } = await getMembership();
    isMember = membership !== "none";
  } catch {
    isMember = false;
  }
  const cta = isMember ? { href: "/training", label: "Bumalik sa Training" } : { href: "/academy", label: "Bumalik sa Academy" };
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Hindi namin makita ang page na &apos;to</h1>
      <p className="text-sm text-muted-foreground">Baka nalipat na ito, o mali ang link. Balik ka na lang sa simula.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href={cta.href} className={cn(buttonVariants({ variant: "default" }), "min-h-11")}>
          {cta.label}
        </Link>
        <Link href="/start" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
          Start here
        </Link>
      </div>
    </div>
  );
}
