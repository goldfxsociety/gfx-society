import type { Metadata } from "next";
import Link from "next/link";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import { REQUEST_COPY as R } from "@/content/access-request";
import { JOIN_COPY as C, SYSTEM_COPY } from "@/content/members-gate";
import { createClient } from "@/lib/supabase/server";

// The token is in the URL: never index it and never send it on as a Referer.
export const metadata: Metadata = {
  title: "Confirm ACCM email | GFX Trading System",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

/**
 * Different-ACCM-email confirmation link landing (spec §5 B). The single-use 24 h token is the only input; the DB
 * (public.confirm_accm_email) answers 'confirmed' or one neutral 'invalid'. No redirect target is read from the URL
 * (no open redirect), and the page never shows which address or account the token belongs to.
 */
export default async function ConfirmAccmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  let ok = false;
  if (/^[0-9a-f]{64}$/.test(token)) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("confirm_accm_email", { p_token: token });
    if (error) console.error("[system/join/confirm] confirm_accm_email failed", { code: error.code });
    ok = !error && data === "confirmed";
  }
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      <p role="status" className="text-sm leading-relaxed">
        {ok ? R.confirmedLanding : C.error}
      </p>
      <Link href="/academy" className="underline inline-flex min-h-11 items-center self-start py-2 text-sm">
        {C.academyLink}
      </Link>
      <p className="text-xs text-muted-foreground">{SYSTEM_COPY.risk}</p>
      <p className="text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
    </div>
  );
}
