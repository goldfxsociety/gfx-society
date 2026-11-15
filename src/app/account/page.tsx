import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { MembersNav } from "@/components/members-home/members-nav";
import { MembersFooter } from "@/components/training/members-footer";
import { RISK_LINE } from "@/config/training";
import { Expander } from "@/components/layout/expander";
import { getMembership } from "@/lib/members/membership";
import { tierFrom } from "@/lib/members/tier";
import { showMembersNav } from "@/lib/training/member-surface";
import { DepositInfo } from "@/components/members/deposit-info";
import { DeleteAccountForm } from "./delete-account-form";
import { MyCourses } from "./my-courses";

export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { membership } = await getMembership();
  // Sprint 3: Explorers (signed in, confirmed email) get the members nav too (explorer-linked-tiers-spec §2.4).
  const explorer = Boolean(user) && tierFrom({ loggedIn: true, confirmed: Boolean(user?.email_confirmed_at), membership }) === "explorer";
  const linked = membership === "active" || membership === "grace";

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">Log in para makita ang account settings mo.</p>
        <Link href="/login?next=/account" className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          Log in
        </Link>
        <p className="text-xs text-muted-foreground" data-testid="risk-line">{RISK_LINE}</p>
      </div>
    );
  }

  const body = (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
          ← Back to Progress
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">Logged in as {user.email}</p>
      </div>

      <MyCourses />

      {/* Sprint 3 (spec §2.3): in-app funding facts for Linked (and grace). Muted, not gold, no IB line. */}
      {linked && <DepositInfo />}

      {/* Simplicity spec v2 P2.6: the Delete copy and form sit in a closed <details>; wording unchanged. */}
      <Expander summary="Delete my account" heading testId="delete-account" className="border-destructive/50">
        <p className="leading-relaxed text-foreground">
          Ide-delete nito agad ang account mo at ang Academy data mo: profile, lesson progress, quiz attempts,
          diagnostic results at activity events. Hindi na ito maibabalik.
        </p>
        <p className="leading-relaxed">
          Itatago lang namin ang consent record mo (anong boxes ang na-tick mo at kailan) nang 3 years, naka-link
          lang sa one-way hash ng email mo, bilang proof of consent, as described in the{" "}
          <Link href="/privacy" className="underline">
            Privacy Notice
          </Link>
          . Para mag-unsubscribe sa emails, gamitin ang Unsubscribe link sa email.
        </p>
        <DeleteAccountForm />
      </Expander>

      {/* Members get the risk line from MembersFooter; everyone else gets it here (once per page either way). */}
      {showMembersNav(membership, explorer) ? null : (
        <p className="text-xs text-muted-foreground" data-testid="risk-line">{RISK_LINE}</p>
      )}
    </div>
  );
  if (!showMembersNav(membership, explorer)) return body;
  return (
    <div className="mx-auto flex w-full flex-1 gap-8 lg:max-w-6xl lg:px-4">
      <MembersNav active="account" />
      <div className="flex min-w-0 flex-1 flex-col pb-24">
        {body}
        <div className="mx-auto w-full max-w-2xl px-6">
          <MembersFooter />
        </div>
      </div>
    </div>
  );
}
