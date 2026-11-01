import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { MEMBERS_IB_DISCLOSURE_TEXT } from "@/config/partners";
import { JOIN_COPY as C } from "@/content/members-gate";
import { getMembership } from "@/lib/members/membership";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join | GFX Trading System", robots: { index: false, follow: false } };

// Minimal neutral layout; final UX needs Design (proposal v5 §2).
export default async function JoinPage() {
  const { loggedIn, membership } = await getMembership();
  if (membership !== "none") redirect("/system/members");

  let body: React.ReactNode;
  if (!loggedIn) {
    body = (
      <>
        <p className="text-sm">{C.loginFirst}</p>
        <Link href="/login?next=/system/join" className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          {C.loginCta}
        </Link>
      </>
    );
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    body = user?.email_confirmed_at ? <JoinForm ibDisclosure={MEMBERS_IB_DISCLOSURE_TEXT} /> : <p className="text-sm">{C.verifyEmailFirst}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      {body}
    </div>
  );
}
