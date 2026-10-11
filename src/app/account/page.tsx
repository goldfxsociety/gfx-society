import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">Log in para makita ang account settings mo.</p>
        <Link href="/login?next=/account" className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}>
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline">
          ← Back to Progress
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">Logged in as {user.email}</p>
      </div>

      <section aria-labelledby="delete-heading" className="flex flex-col gap-3 rounded-lg border border-destructive/50 p-4">
        <h2 id="delete-heading" className="text-lg font-semibold">Delete my account</h2>
        <p className="text-sm leading-relaxed">
          Ide-delete nito agad ang account mo at ang Academy data mo: profile, lesson progress, quiz attempts,
          diagnostic results at activity events. Hindi na ito maibabalik.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Itatago lang namin ang consent record mo (anong boxes ang na-tick mo at kailan) nang 3 years, naka-link
          lang sa one-way hash ng email mo, bilang proof of consent, as described in the{" "}
          <Link href="/privacy" className="underline">
            Privacy Notice
          </Link>
          . Para mag-unsubscribe sa emails, gamitin ang Unsubscribe link sa email.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
