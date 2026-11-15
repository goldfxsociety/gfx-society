import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitch } from "@/components/academy/language-switch";
import { Expander } from "@/components/layout/expander";
import { buttonVariants } from "@/components/ui/button";
import { IB_DISCLOSURE_TEXT, IB_DISCLOSURE_TEXT_EN } from "@/config/partners";
import { RISK_LINE_EN_SHORT } from "@/config/training";
import { JOIN_COPY, JOIN_COPY_EN, SYSTEM_COPY } from "@/content/members-gate";
import { manilaDate } from "@/lib/members/access-request";
import { accmConfirmMailCanSend } from "@/lib/members/accm-confirm-send";
import { getMembership } from "@/lib/members/membership";
import { MEMBERS_HOME, joinLoginPath, joinSignupPath, memberNext, type JoinBase } from "@/lib/members/routes";
import { GOLD_RESET_PATH, isGoldResetPath } from "@/lib/members/tier";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { JoinForm, type JoinRequestView } from "./join-form";

type JoinStateRpc = {
  consent?: boolean;
  request?: { status?: string; created_at?: string; ib_name?: string | null } | null;
} | null;

// One front door (access journey v2): auto-detect logged out / unconfirmed / member / not yet / request in.
// Logged out: login CTA only (no email field, no allowlist check). Member: straight to the safe `next` or /training.
// /system/join (PH) and /en/system/join (EN) render this with the same logic, actions and RPCs (simplicity spec v2).
export async function JoinView({ lang, nextParam }: { lang: "tl" | "en"; nextParam: string | null }) {
  const en = lang === "en";
  const C = en ? JOIN_COPY_EN : JOIN_COPY;
  const base: JoinBase = en ? "/en/system/join" : "/system/join";
  const accm = en ? "/en/accm" : "/accm";
  const dest = memberNext(nextParam);
  const next = dest === MEMBERS_HOME ? "" : dest;
  const { loggedIn, membership } = await getMembership();
  if (membership !== "none") redirect(dest);

  const link = "underline inline-flex min-h-11 items-center py-2";
  const pageHelp = (
    <Expander summary={C.helpSummary} testId="join-help">
      <Link href="/academy" className={link}>
        {C.academyLink}
      </Link>
      <Link href={accm} className={cn(link, "text-xs")}>
        {C.accmLink}
      </Link>
    </Expander>
  );

  let body: React.ReactNode;
  if (!loggedIn) {
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{C.loggedOutIntro}</p>
        <Link href={joinLoginPath(next, base)} className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          {C.loginCta}
        </Link>
        <p className="text-sm">
          {C.signupPrompt}{" "}
          <Link href={joinSignupPath(next, base)} className={link}>
            {C.signupLink}
          </Link>
        </p>
        {pageHelp}
      </div>
    );
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !user.email_confirmed_at) {
      body = (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed">{C.unverifiedEmail}</p>
          {pageHelp}
        </div>
      );
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
          goldResetHref={isGoldResetPath(next) ? next : GOLD_RESET_PATH}
          forGoldReset={isGoldResetPath(next)}
          mailerCanSend={accmConfirmMailCanSend()}
          lang={lang}
        />
      );
    }
  }

  return (
    <div lang={en ? "en" : "fil"} className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <LanguageSwitch current={lang} enHref="/en/system/join" tlHref="/system/join" location="join" />
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      {body}
      <p className="text-xs text-muted-foreground" data-testid="risk-line">{en ? RISK_LINE_EN_SHORT : SYSTEM_COPY.risk}</p>
      {/* Partner line (P2-C): public pages that mention ACCM. */}
      <p className="text-xs text-muted-foreground" data-testid="ib-line">{en ? IB_DISCLOSURE_TEXT_EN : IB_DISCLOSURE_TEXT}</p>
    </div>
  );
}
