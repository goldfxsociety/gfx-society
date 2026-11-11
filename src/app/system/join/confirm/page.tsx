import type { Metadata } from "next";
import Link from "next/link";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import { JOIN_COPY as C, SYSTEM_COPY } from "@/content/members-gate";
import { ACCM_CONFIRM_MAIL_LIVE } from "@/lib/members/access-request";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "./confirm-form";

// Never index; never send a Referer (also a route-level Referrer-Policy: no-referrer header in next.config.ts).
export const metadata: Metadata = {
  title: "Confirm ACCM email | GFX Trading System",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

/**
 * Different-ACCM-email confirmation landing (spec §5 B; QA N1). The GET render NEVER confirms and never reads a
 * token: the token is in the URL fragment (#token=), read by the client form, and sent only in the POST body of the
 * "I-confirm" button. The POST needs the signed-in requester (SQL checks auth.uid() = request owner). No redirect
 * target is read from the URL, and the page never shows which address or account the token belongs to.
 */
export default async function ConfirmAccmEmailPage() {
  let loggedIn = false;
  if (ACCM_CONFIRM_MAIL_LIVE) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    loggedIn = Boolean(user);
  }
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      {ACCM_CONFIRM_MAIL_LIVE ? (
        <ConfirmForm loggedIn={loggedIn} />
      ) : (
        <p role="status" className="text-sm leading-relaxed">
          {C.error}
        </p>
      )}
      <Link href="/academy" className="underline inline-flex min-h-11 items-center self-start py-2 text-sm">
        {C.academyLink}
      </Link>
      <p className="text-xs text-muted-foreground">{SYSTEM_COPY.risk}</p>
      <p className="text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
    </div>
  );
}
