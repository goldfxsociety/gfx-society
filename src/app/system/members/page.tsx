import type { Metadata } from "next";
import { MEMBERS_COPY as C } from "@/content/members-gate";
import { requireMember } from "@/lib/members/membership";

export const metadata: Metadata = { title: "Members | GFX Trading System", robots: { index: false, follow: false } };

// Placeholder members-only page proving the gate. Real members home (/training) comes in PR 2; needs Design.
export default async function MembersPage() {
  const status = await requireMember("/system/members");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">{C.title}</h1>
      <p className="leading-relaxed">{C.body}</p>
      {status === "grace" && (
        <p className="text-sm text-destructive" role="alert">
          {C.grace}
        </p>
      )}
    </div>
  );
}
