import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { MESSENGER_INVITE_URL, resolveGoCode } from "@/lib/links/go-codes";
import { GoRedirect } from "./go-redirect";

export const metadata: Metadata = {
  title: "GFX Society",
  robots: { index: false, follow: false },
};

/**
 * Interstitial (not a server 302) so Vercel Web Analytics counts a page view at /go/<code>.
 * Clicks are counted, not community joins.
 */
export default async function GoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const target = resolveGoCode(code);
  if (!target) notFound();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-xl font-bold">Welcome to GFX Society</h1>
      <p className="text-sm text-muted-foreground">
        Free gold trading education. Taking you to the Academy…
      </p>
      <Link href={target.href} className={buttonVariants({ variant: "default" })}>
        Start learning →
      </Link>
      {MESSENGER_INVITE_URL && (
        <a
          href={MESSENGER_INVITE_URL}
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          Join the GFX Messenger community
        </a>
      )}
      <p className="text-xs text-muted-foreground">
        Education only, not financial advice. High risk of loss. Demo first.
      </p>
      <GoRedirect href={target.href} />
    </div>
  );
}
