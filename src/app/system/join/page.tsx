import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import { JOIN_COPY as C, SYSTEM_COPY } from "@/content/members-gate";
import { manilaDate, nextFirstManila } from "@/lib/members/access-request";
import { getMembership } from "@/lib/members/membership";
import { MEMBERS_HOME, joinLoginPath, joinSignupPath, memberNext } from "@/lib/members/routes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { JoinForm, type JoinRequestView } from "./join-form";

export const metadata: Metadata = { title: "Join | GFX Trading System", robots: { index: false, follow: false } };

type JoinStateRpc = {
  consent?: boolean;
  request?: { status?: string; created_at?: string; ib_name?: string | null } | null;
} | null;

// One front door (access journey v2): auto-detect logged out / unconfirmed / member / not yet / request in.
// Logged out: login CTA only (no email field, no allowlist check). Member: straight to the safe `next` or /training.
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const dest = memberNext(typeof sp.next === "string" ? sp.next : null);
  const next = dest === MEMBERS_HOME ? "" : dest;
  const { loggedIn, membership } = await getMembership();
  if (membership !== "none") redirect(dest);

  let body: React.ReactNode;
  if (!loggedIn) {
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed">{C.loggedOutBody}</p>
        <Link href={joinLoginPath(next)} className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          {C.loginCta}
        </Link>
        <p className="text-sm">
          {C.signupPrompt}{" "}
          <Link href={joinSignupPath(next)} className="underline inline-flex min-h-11 items-center py-2">
            {C.signupLink}
          </Link>
        </p>
      </div>
    );
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !user.email_confirmed_at) {
      body = <p className="text-sm leading-relaxed">{C.unverifiedEmail}</p>;
    } else {
      const { data } = await supabase.rpc("my_join_state");
      const s = (data ?? null) as JoinStateRpc;
      const r = s?.request;
      const request: JoinRequestView | null =
        r && (r.status === "pending" || r.status === "awaiting_email_confirm") && r.created_at
          ? { status: r.status, submitted: manilaDate(r.created_at), ibName: r.ib_name ?? null }
          : null;
      body = (
        <JoinForm
          next={next}
          consentRecorded={s?.consent === true}
          academyEmail={user.email}
          request={request}
          nextFirst={nextFirstManila()}
        />
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      {body}
      <div className="flex flex-col items-start text-sm">
        <Link href="/academy" className="underline inline-flex min-h-11 items-center py-2">
          {C.academyLink}
        </Link>
        <Link href="/accm" className="text-xs text-muted-foreground underline inline-flex min-h-11 items-center py-2">
          {C.accmLink}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">{SYSTEM_COPY.risk}</p>
      {/* Partner line (Ben, P2-C): public pages that mention ACCM. */}
      <p className="text-xs text-muted-foreground">{IB_DISCLOSURE_TEXT}</p>
    </div>
  );
}
