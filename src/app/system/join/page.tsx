import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { IB_DISCLOSURE_TEXT } from "@/config/partners";
import { JOIN_COPY as C, SYSTEM_COPY } from "@/content/members-gate";
import { getMembership } from "@/lib/members/membership";
import { JOIN_LOGIN_PATH, JOIN_SIGNUP_PATH, MEMBERS_HOME } from "@/lib/members/routes";
import { cn } from "@/lib/utils";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join | GFX Trading System", robots: { index: false, follow: false } };

// Academy login reuse (Ben via Jarvis, 11 Nov): log in with the normal Academy account (/login), then consent.
// Logged out: login CTA only (no email field, no allowlist check). Member: straight to /training.
export default async function JoinPage() {
  const { loggedIn, membership } = await getMembership();
  if (membership !== "none") redirect(MEMBERS_HOME);
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      {loggedIn ? (
        <JoinForm />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed">{C.loggedOutBody}</p>
          <Link href={JOIN_LOGIN_PATH} className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
            {C.loginCta}
          </Link>
          <p className="text-sm">
            {C.signupPrompt}{" "}
            <Link href={JOIN_SIGNUP_PATH} className="underline inline-flex min-h-11 items-center py-2">
              {C.signupLink}
            </Link>
          </p>
        </div>
      )}
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
