import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JOIN_COPY as C, SYSTEM_COPY } from "@/content/members-gate";
import { getMembership } from "@/lib/members/membership";
import { MEMBERS_HOME } from "@/lib/members/routes";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join | GFX Trading System", robots: { index: false, follow: false } };

// One-step passwordless email-code join (Ben's redesign, 2 Nov; Design Addendum C).
// No login needed first: the 6-digit code IS the login. Minimal layout; final UX = Design.
export default async function JoinPage() {
  const { membership } = await getMembership();
  if (membership !== "none") redirect(MEMBERS_HOME);
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      <JoinForm />
      <p className="text-xs text-muted-foreground">{SYSTEM_COPY.risk}</p>
    </div>
  );
}
